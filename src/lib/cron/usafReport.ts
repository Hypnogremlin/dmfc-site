import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import { MEMBERSHIP_SEASON } from "@/lib/member-types";

// Columns pulled for the report — exactly what the USA Fencing Bulk Uploader
// template needs. No medical data is exported.
type MemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  birthday: string;
  sex_at_birth: "male" | "female" | null;
  usa_fencing_number: string | null;
  contact_email: string;
  contact_phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip_code: string;
  citizenship_country: string;
  representing_country: string;
  // Agreements live on a separate member_waivers row (one per profile per
  // season), not on profiles itself — see 20260623_waivers_reshape_guardian_usafnum.sql.
  member_waivers: {
    season_year: string;
    individual_waiver_agreed: boolean;
    maapp_agreed: boolean;
    rules_club_athlete_agreed: boolean;
    athlete_coc_agreed: boolean;
  }[];
};

// The current season's waiver row for a member, if any.
function currentWaiver(m: MemberRow) {
  return m.member_waivers.find((w) => w.season_year === MEMBERSHIP_SEASON);
}

// Postgres DATE columns serialize as "yyyy-mm-dd". USAF's template wants
// US-order month/day/year with no leading zeros (confirmed against a real
// accepted upload — the written instructions doc actually says day-first,
// which is wrong). Parsed via string split rather than `new Date()` to avoid
// a UTC-offset day shift on a plain calendar date.
function formatUsafDob(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${Number(month)}/${Number(day)}/${year}`;
}

const GENDER_CODE: Record<"male" | "female", string> = {
  male: "m",
  female: "f",
};

// CSV columns in the exact order/headers of USA Fencing's Bulk Uploader
// template. Row 1 headers must match the downloaded template byte-for-byte.
const COLUMNS: [string, (m: MemberRow) => string][] = [
  ["Membership#", (m) => m.usa_fencing_number ?? ""],
  ["LastName", (m) => m.last_name],
  ["FirstName", (m) => m.first_name],
  ["DOB", (m) => formatUsafDob(m.birthday)],
  ["Email", (m) => m.contact_email],
  ["Gender", (m) => (m.sex_at_birth ? GENDER_CODE[m.sex_at_birth] : "")],
  [
    "Address#1",
    (m) =>
      m.address_line2
        ? `${m.address_line1}, ${m.address_line2}`
        : m.address_line1,
  ],
  ["City", (m) => m.city],
  ["State", (m) => m.state],
  ["Zip", (m) => m.zip_code],
  ["Citizenship", (m) => m.citizenship_country],
  ["RepresentingCountry", (m) => m.representing_country],
  ["Note", () => ""],
  ["Phone#", (m) => m.contact_phone],
  [
    "Signed Membership Waiver",
    (m) => (currentWaiver(m)?.individual_waiver_agreed ? "X" : ""),
  ],
  ["Signed MAAPP Policy", (m) => (currentWaiver(m)?.maapp_agreed ? "X" : "")],
  // Required for every completed enrollment (adult or minor) per the
  // enrollment form's validation — matches the real template, where this
  // column is "X" even for adult fencers with no guardian on file.
  [
    "Parent Signature",
    (m) => (currentWaiver(m)?.rules_club_athlete_agreed ? "X" : ""),
  ],
  [
    "Signed Code of Conduct",
    (m) => (currentWaiver(m)?.athlete_coc_agreed ? "X" : ""),
  ],
];

// Quote a cell only when it contains a comma, quote, or newline; double internal
// quotes per RFC 4180.
function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsv(members: MemberRow[]): string {
  const header = COLUMNS.map(([name]) => csvCell(name)).join(",");
  const lines = members.map((m) =>
    COLUMNS.map(([, get]) => csvCell(get(m))).join(",")
  );
  // Leading BOM so Excel opens UTF-8 (accented names) correctly.
  return "﻿" + [header, ...lines].join("\r\n");
}

// Weekly USA Fencing membership report pass. Extracted unchanged from the
// former standalone /api/cron/usaf-report route — see
// src/app/api/cron/emails/route.ts for the consolidated entry point, which
// only invokes this on Mondays.
export async function runUsafReportPass() {
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;
  if (!recipient) {
    console.error("[cron/usaf-report] REPORT_RECIPIENT_EMAIL is not set");
    return { ok: false, error: "REPORT_RECIPIENT_EMAIL not configured", members_reported: 0 };
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error("[cron/usaf-report] RESEND_API_KEY is not set");
    return { ok: false, error: "RESEND_API_KEY not configured", members_reported: 0 };
  }

  // ── 1. Fetch completed members not yet included in any report ──────────────
  const supabase = createServiceClient();
  const { data: rows, error: fetchError } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, birthday, sex_at_birth, usa_fencing_number, " +
        "contact_email, contact_phone, address_line1, address_line2, city, state, zip_code, " +
        "citizenship_country, representing_country, " +
        "member_waivers(season_year, individual_waiver_agreed, maapp_agreed, rules_club_athlete_agreed, athlete_coc_agreed)"
    )
    .eq("enrollment_complete", true)
    // Guardian rows (person_type = 'guardian') default enrollment_complete
    // to false, so they're already excluded above — but this path submits
    // members to USA Fencing, the highest-consequence write in the
    // codebase, so it must not rely on that being an accident. See
    // VOLUNTEERS.md "Blast radius of person_type".
    .eq("person_type", "athlete")
    .is("usaf_reported_at", null)
    .order("created_at", { ascending: true });

  if (fetchError) {
    console.error("[cron/usaf-report] Supabase fetch error:", fetchError);
    return { ok: false, error: fetchError.message, members_reported: 0 };
  }

  // ── 2. Nothing new → send nothing ──────────────────────────────────────────
  if (!rows || rows.length === 0) {
    console.log("[cron/usaf-report] No new members to report.");
    return { ok: true, members_reported: 0 };
  }

  const members = rows as unknown as MemberRow[];
  const csv = buildCsv(members);
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const filename = `dmfc-usaf-bulk-upload-${today}.csv`;
  const count = members.length;

  // ── 3. Email the CSV to the president ──────────────────────────────────────
  const resend = new Resend(resendApiKey);
  const FROM =
    "Des Moines Fencing Club <noreply@emails.desmoinesfencingclub.org>";

  const memberWord = count === 1 ? "member" : "members";
  const { error: sendError } = await resend.emails.send({
    from: FROM,
    to: recipient,
    subject: `New DMFC members for USA Fencing tracking — ${today} (${count})`,
    text:
      `${count} new ${memberWord} completed enrollment since the last report.\n\n` +
      `The attached CSV (${filename}) is formatted for the USA Fencing Club ` +
      `Manager Bulk Uploader — download it and upload as-is under Roster > ` +
      `Bulk Uploader > Start a new Upload, membership type "Access". ` +
      `Each member appears in this report only once.`,
    attachments: [
      {
        filename,
        content: Buffer.from(csv, "utf-8"),
      },
    ],
  });

  if (sendError) {
    // Do NOT stamp usaf_reported_at — leave the members unreported so the next
    // run retries them rather than silently dropping a member from tracking.
    console.error("[cron/usaf-report] Resend error:", sendError);
    return { ok: false, error: sendError.message, members_reported: 0 };
  }

  // ── 4. Mark the reported members so they're never re-sent ──────────────────
  const reportedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ usaf_reported_at: reportedAt })
    // Redundant with the fetch filter above (these ids only ever came from
    // athlete rows), but the flag this sets is what marks a member reported
    // to USA Fencing — belt-and-suspenders here costs nothing.
    .eq("person_type", "athlete")
    .in(
      "id",
      members.map((m) => m.id)
    );

  if (updateError) {
    // Email already went out. Log the flag failure but return 200 — a duplicate
    // member on next week's report is far better than a false cron failure.
    console.error(
      "[cron/usaf-report] Failed to set usaf_reported_at:",
      updateError
    );
  }

  console.log(
    `[cron/usaf-report] Done. Reported ${count} new ${memberWord} to ${recipient}.`
  );
  return { ok: true, members_reported: count };
}

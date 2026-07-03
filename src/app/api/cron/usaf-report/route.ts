import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import type { WeaponClass } from "@/lib/member-types";

// Columns pulled for the report — a focused subset of profiles aimed at USA
// Fencing registration. No medical/waiver data is exported.
type MemberRow = {
  id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  birthday: string;
  sex_at_birth: string | null;
  usa_fencing_number: string | null;
  weapon_classes: WeaponClass[] | null;
  membership_season: string | null;
  contact_email: string;
  contact_phone: string;
  guardian_first_name: string | null;
  guardian_last_name: string | null;
  guardian_phone: string | null;
};

const WEAPON_LABELS: Record<WeaponClass, string> = {
  "foil-youth": "Foil (Youth)",
  "foil-adult": "Foil (Adult)",
  epee: "Epee",
  saber: "Saber",
};

// CSV columns in output order: [header, value extractor].
const COLUMNS: [string, (m: MemberRow) => string][] = [
  ["Enrolled On", (m) => (m.created_at ? m.created_at.slice(0, 10) : "")],
  ["Last Name", (m) => m.last_name],
  ["First Name", (m) => m.first_name],
  ["Birthday", (m) => m.birthday],
  ["Sex at Birth", (m) => m.sex_at_birth ?? ""],
  ["USA Fencing #", (m) => m.usa_fencing_number ?? ""],
  [
    "Weapon Classes",
    (m) =>
      (m.weapon_classes ?? [])
        .map((w) => WEAPON_LABELS[w] ?? w)
        .join("; "),
  ],
  ["Membership Season", (m) => m.membership_season ?? ""],
  ["Contact Email", (m) => m.contact_email],
  ["Contact Phone", (m) => m.contact_phone],
  [
    "Guardian Name",
    (m) =>
      [m.guardian_first_name, m.guardian_last_name]
        .filter(Boolean)
        .join(" "),
  ],
  ["Guardian Phone", (m) => m.guardian_phone ?? ""],
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

// Vercel invokes cron jobs via GET with an Authorization header containing the
// CRON_SECRET env var as a Bearer token. We reject anything else.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const recipient = process.env.REPORT_RECIPIENT_EMAIL;
  if (!recipient) {
    console.error("[cron/usaf-report] REPORT_RECIPIENT_EMAIL is not set");
    return Response.json(
      { ok: false, error: "REPORT_RECIPIENT_EMAIL not configured" },
      { status: 500 }
    );
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error("[cron/usaf-report] RESEND_API_KEY is not set");
    return Response.json(
      { ok: false, error: "RESEND_API_KEY not configured" },
      { status: 500 }
    );
  }

  // ── 1. Fetch completed members not yet included in any report ──────────────
  const supabase = createServiceClient();
  const { data: rows, error: fetchError } = await supabase
    .from("profiles")
    .select(
      "id, created_at, first_name, last_name, birthday, sex_at_birth, usa_fencing_number, weapon_classes, membership_season, contact_email, contact_phone, guardian_first_name, guardian_last_name, guardian_phone"
    )
    .eq("enrollment_complete", true)
    .is("usaf_reported_at", null)
    .order("created_at", { ascending: true });

  if (fetchError) {
    console.error("[cron/usaf-report] Supabase fetch error:", fetchError);
    return Response.json(
      { ok: false, error: fetchError.message },
      { status: 500 }
    );
  }

  // ── 2. Nothing new → send nothing ──────────────────────────────────────────
  if (!rows || rows.length === 0) {
    console.log("[cron/usaf-report] No new members to report.");
    return Response.json({ ok: true, members_reported: 0 });
  }

  const members = rows as MemberRow[];
  const csv = buildCsv(members);
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const filename = `dmfc-new-members-${today}.csv`;
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
      `The attached CSV (${filename}) lists them for USA Fencing membership ` +
      `tracking. Each member appears in this report only once.`,
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
    return Response.json(
      { ok: false, error: sendError.message },
      { status: 500 }
    );
  }

  // ── 4. Mark the reported members so they're never re-sent ──────────────────
  const reportedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ usaf_reported_at: reportedAt })
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
  return Response.json({ ok: true, members_reported: count });
}

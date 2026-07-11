import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import { MembershipInvite, subject } from "@/emails/MembershipInvite";
import type { Weapon } from "@/components/ObservationCalendar";

// Row shape returned from Supabase — matches the observation_requests schema.
type ObservationRow = {
  id: number;
  submission_id: string;
  name: string;
  email: string;
  visit_date: string;
  weapon: Weapon;
  signup_invite_sent: boolean;
  converted_to_member_id: string | null;
};

// Day-after-observation membership signup invite pass. For each RSVP
// submission whose LAST scheduled visit was yesterday, sends one invite
// email pointing at the enrollment flow — unless the visitor already
// converted (converted_to_member_id set) or already has a member profile
// under the same email (in case an admin never got around to setting
// converted_to_member_id by hand).
export async function runSignupInvitePass() {
  // ── 1. Compute yesterday's date in UTC ─────────────────────────────────────
  // Consistent with the remind pass's "tomorrow" computation — the cron fires
  // at noon UTC, so "yesterday" here means the day before today in UTC.
  const now = new Date();
  const yesterday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)
  );
  const yesterdayStr = yesterday.toISOString().slice(0, 10); // "YYYY-MM-DD"

  const supabase = createServiceClient();

  // ── 2. Find candidate submissions: a not-yet-invited row visiting yesterday ─
  const { data: candidateRows, error: candidateError } = await supabase
    .from("observation_requests")
    .select("submission_id")
    .eq("visit_date", yesterdayStr)
    .eq("signup_invite_sent", false);

  if (candidateError) {
    console.error("[cron/signupInvite] Supabase fetch error:", candidateError);
    return { ok: false, error: candidateError.message, invites_sent: 0 };
  }

  if (!candidateRows || candidateRows.length === 0) {
    console.log(`[cron/signupInvite] No candidate visits for ${yesterdayStr}`);
    return { ok: true, invites_sent: 0 };
  }

  const submissionIds = Array.from(
    new Set(candidateRows.map((r) => r.submission_id as string))
  );

  // ── 3. Pull every row for those submissions ─────────────────────────────────
  // Needed to compute each submission's true last visit date — a multi-day
  // RSVP shouldn't be invited until after its FINAL session, not its first.
  const { data: fullRows, error: fullError } = await supabase
    .from("observation_requests")
    .select(
      "id, submission_id, name, email, visit_date, weapon, signup_invite_sent, converted_to_member_id"
    )
    .in("submission_id", submissionIds);

  if (fullError) {
    console.error("[cron/signupInvite] Supabase full-fetch error:", fullError);
    return { ok: false, error: fullError.message, invites_sent: 0 };
  }

  const typedRows = (fullRows ?? []) as ObservationRow[];

  const bySubmission = new Map<string, ObservationRow[]>();
  for (const row of typedRows) {
    const group = bySubmission.get(row.submission_id) ?? [];
    group.push(row);
    bySubmission.set(row.submission_id, group);
  }

  // ── 4. Filter to groups whose last session was exactly yesterday, not yet
  // invited, and not already converted ────────────────────────────────────────
  const eligibleGroups: ObservationRow[][] = [];
  for (const group of bySubmission.values()) {
    const maxDate = group.reduce(
      (max, r) => (r.visit_date > max ? r.visit_date : max),
      group[0].visit_date
    );
    if (maxDate !== yesterdayStr) continue; // more sessions still to come
    if (group.some((r) => r.signup_invite_sent)) continue; // already invited
    if (group.some((r) => r.converted_to_member_id)) continue; // already a member
    eligibleGroups.push(group);
  }

  if (eligibleGroups.length === 0) {
    console.log(
      `[cron/signupInvite] No eligible submissions for ${yesterdayStr}`
    );
    return { ok: true, invites_sent: 0 };
  }

  // ── 5. Exclude visitors who already have a member profile under this email
  // ── (catches conversions an admin never manually flagged) ───────────────────
  const emails = eligibleGroups.map((g) => g[0].email);
  const { data: existingProfiles, error: profilesError } = await supabase
    .from("profiles")
    .select("contact_email")
    .in("contact_email", emails);

  if (profilesError) {
    console.error(
      "[cron/signupInvite] Supabase profiles-check error:",
      profilesError
    );
    return { ok: false, error: profilesError.message, invites_sent: 0 };
  }

  const memberEmails = new Set(
    (existingProfiles ?? []).map((p) => p.contact_email.toLowerCase())
  );

  const toInvite = eligibleGroups.filter(
    (group) => !memberEmails.has(group[0].email.toLowerCase())
  );

  if (toInvite.length === 0) {
    console.log(
      `[cron/signupInvite] All eligible visitors for ${yesterdayStr} are already members.`
    );
    return { ok: true, invites_sent: 0 };
  }

  // ── 6. Send an invite per eligible submission ───────────────────────────────
  const resend = new Resend(process.env.RESEND_API_KEY);
  const FROM =
    "Des Moines Fencing Club <noreply@emails.desmoinesfencingclub.org>";

  let invitesSent = 0;
  const successfulIds: number[] = [];

  for (const group of toInvite) {
    const first = group[0];
    const firstName = first.name.split(" ")[0];

    try {
      const { error: sendError } = await resend.emails.send({
        from: FROM,
        to: first.email,
        subject: subject(firstName),
        react: MembershipInvite({ visitorName: first.name }),
      });

      if (sendError) {
        console.error(
          `[cron/signupInvite] Resend error for ${first.submission_id}:`,
          sendError
        );
        // Don't flip the flag — retry on the next day's run.
      } else {
        successfulIds.push(...group.map((r) => r.id));
        invitesSent++;
      }
    } catch (err) {
      console.error(
        `[cron/signupInvite] Unexpected error for ${first.submission_id}:`,
        err
      );
    }
  }

  // ── 7. Flip signup_invite_sent for rows we successfully emailed ────────────
  if (successfulIds.length > 0) {
    const { error: updateError } = await supabase
      .from("observation_requests")
      .update({ signup_invite_sent: true })
      .in("id", successfulIds);

    if (updateError) {
      console.error(
        "[cron/signupInvite] Failed to update signup_invite_sent flags:",
        updateError
      );
    }
  }

  console.log(
    `[cron/signupInvite] Done. ${invitesSent} invite(s) sent for ${yesterdayStr}.`
  );
  return { ok: true, invites_sent: invitesSent };
}

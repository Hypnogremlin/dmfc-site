import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import { ObservationReminder, subject } from "@/emails/ObservationReminder";
import type { Weapon } from "@/components/ObservationCalendar";

// Row shape returned from Supabase — matches the observation_requests schema.
type ObservationRow = {
  id: number;
  submission_id: string;
  name: string;
  email: string;
  phone: string | null;
  visitor_type: "athlete" | "parent";
  child_name: string | null;
  party_size: number;
  notes: string | null;
  visit_date: string;
  weapon: Weapon;
  reminder_sent: boolean;
  created_at: string;
};

// ~24h-before reminder pass for tomorrow's observation visits. Extracted
// unchanged from the former standalone /api/cron/remind route — see
// src/app/api/cron/emails/route.ts for the consolidated entry point.
export async function runRemindPass() {
  // ── 1. Compute tomorrow's date in UTC ──────────────────────────────────────
  // The cron fires at noon UTC (0 12 * * *). Using UTC dates avoids any
  // timezone ambiguity when matching against visit_date values in Supabase,
  // which are stored as ISO date strings (YYYY-MM-DD) from the form calendar.
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
  const tomorrowStr = tomorrow.toISOString().slice(0, 10); // "YYYY-MM-DD"

  // ── 2. Fetch unreminded rows for tomorrow ──────────────────────────────────
  const supabase = createServiceClient();
  const { data: rows, error: fetchError } = await supabase
    .from("observation_requests")
    .select("*")
    .eq("visit_date", tomorrowStr)
    .eq("reminder_sent", false);

  if (fetchError) {
    console.error("[cron/remind] Supabase fetch error:", fetchError);
    return { ok: false, error: fetchError.message, reminders_sent: 0 };
  }

  if (!rows || rows.length === 0) {
    console.log(`[cron/remind] No unreminded visits for ${tomorrowStr}`);
    return { ok: true, reminders_sent: 0 };
  }

  const typedRows = rows as ObservationRow[];

  // ── 3. Group rows by submission_id ─────────────────────────────────────────
  // A single RSVP can include multiple weapons on the same day (e.g. Foil
  // Youth + Épée on Monday). Group them so each visitor gets one email
  // listing all their sessions rather than one email per weapon.
  const bySubmission = new Map<string, ObservationRow[]>();
  for (const row of typedRows) {
    const group = bySubmission.get(row.submission_id) ?? [];
    group.push(row);
    bySubmission.set(row.submission_id, group);
  }

  // ── 4. Send a reminder per unique submission ───────────────────────────────
  const resend = new Resend(process.env.RESEND_API_KEY);
  const FROM =
    "Des Moines Fencing Club <noreply@emails.desmoinesfencingclub.org>";

  let remindersSent = 0;
  const successfulIds: number[] = [];

  for (const [, sessionRows] of bySubmission) {
    const first = sessionRows[0];
    const sessions = sessionRows.map((r) => ({
      date: r.visit_date,
      weapon: r.weapon,
    }));
    const firstName = first.name.split(" ")[0];

    try {
      const { error: sendError } = await resend.emails.send({
        from: FROM,
        to: first.email,
        subject: subject(firstName),
        react: ObservationReminder({
          visitorName: first.name,
          sessions,
          partySize: first.party_size,
        }),
      });

      if (sendError) {
        console.error(
          `[cron/remind] Resend error for ${first.submission_id}:`,
          sendError
        );
        // Don't add to successfulIds — leave reminder_sent = false so the
        // next day's run can retry (though for a ~24h reminder that's moot,
        // this keeps the flag semantically correct).
      } else {
        successfulIds.push(...sessionRows.map((r) => r.id));
        remindersSent++;
      }
    } catch (err) {
      console.error(
        `[cron/remind] Unexpected error for ${first.submission_id}:`,
        err
      );
    }
  }

  // ── 5. Flip reminder_sent for rows we successfully emailed ─────────────────
  if (successfulIds.length > 0) {
    const { error: updateError } = await supabase
      .from("observation_requests")
      .update({ reminder_sent: true })
      .in("id", successfulIds);

    if (updateError) {
      // Emails were already sent. Log the flag failure but return 200 —
      // the worst outcome is a duplicate reminder on the next run, which
      // is far better than a 500 that causes Vercel to log a false failure.
      console.error(
        "[cron/remind] Failed to update reminder_sent flags:",
        updateError
      );
    }
  }

  console.log(
    `[cron/remind] Done. ${remindersSent} reminder(s) sent for ${tomorrowStr}.`
  );
  return { ok: true, reminders_sent: remindersSent };
}

import type { NextRequest } from "next/server";
import { runRemindPass } from "@/lib/cron/remind";
import { runSignupInvitePass } from "@/lib/cron/signupInvite";
import { runUsafReportPass } from "@/lib/cron/usafReport";

// Single daily cron entry point for all three email passes, consolidated
// from three separate Vercel cron jobs (remind, usaf-report, and the new
// signup-invite pass) into one — kept conservative against the Vercel Hobby
// plan's cron-job-count limits rather than assuming today's exact cap holds.
// Fires once daily at noon UTC (see vercel.json). Each pass is independently
// try/caught so one failing pass doesn't block the others.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let remindersSent = 0;
  let invitesSent = 0;
  let usafReportRan = false;
  let usafMembersReported = 0;
  const errors: string[] = [];

  try {
    const result = await runRemindPass();
    remindersSent = result.reminders_sent;
    if (!result.ok) errors.push(`remind: ${result.error}`);
  } catch (err) {
    console.error("[cron/emails] remind pass threw:", err);
    errors.push(`remind: ${String(err)}`);
  }

  try {
    const result = await runSignupInvitePass();
    invitesSent = result.invites_sent;
    if (!result.ok) errors.push(`signupInvite: ${result.error}`);
  } catch (err) {
    console.error("[cron/emails] signupInvite pass threw:", err);
    errors.push(`signupInvite: ${String(err)}`);
  }

  // USA Fencing report is weekly — only run it on Mondays (UTC).
  if (new Date().getUTCDay() === 1) {
    usafReportRan = true;
    try {
      const result = await runUsafReportPass();
      usafMembersReported = result.members_reported;
      if (!result.ok) errors.push(`usafReport: ${result.error}`);
    } catch (err) {
      console.error("[cron/emails] usafReport pass threw:", err);
      errors.push(`usafReport: ${String(err)}`);
    }
  }

  console.log(
    `[cron/emails] Done. reminders=${remindersSent} invites=${invitesSent} ` +
      `usafReportRan=${usafReportRan} usafMembersReported=${usafMembersReported}` +
      (errors.length > 0 ? ` errors=${JSON.stringify(errors)}` : "")
  );

  return Response.json({
    ok: errors.length === 0,
    reminders_sent: remindersSent,
    invites_sent: invitesSent,
    usaf_report_ran: usafReportRan,
    usaf_members_reported: usafMembersReported,
    ...(errors.length > 0 ? { errors } : {}),
  });
}

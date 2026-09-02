import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSessionClient } from "@/lib/supabase-server";
import { Section } from "@/components/Section";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { formatClubDateTime, upcomingCutoffIso } from "@/lib/volunteer/datetime";
import {
  isCancellationInScope,
  isStaffCancelled,
} from "@/lib/volunteer/cancellations";
import { markVolunteerCancellationsSeen } from "../actions";

export const metadata: Metadata = {
  title: "My Volunteer Commitments",
};

type CommitmentRow = {
  id: string;
  attendee_profile_id: string | null;
  attendee_name: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  volunteer_slots: {
    role_name: string;
    start_at: string | null;
    events: {
      id: string;
      title: string;
    } | null;
  } | null;
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "Time TBD";
  return formatClubDateTime(iso);
}

// Who was actually going to work this shift. Shared by the live list and the
// cancelled-by-DMFC notice, so an account holding several people is told which
// of them lost the spot — "your shift was cancelled" is not useful to a parent
// who signed up two kids and themselves.
function attendeeLabel(
  signup: Pick<CommitmentRow, "attendee_profile_id" | "attendee_name">,
  nameById: Map<string, string>
): string {
  return signup.attendee_profile_id
    ? nameById.get(signup.attendee_profile_id) ?? "Someone on your account"
    : signup.attendee_name ?? "Someone else";
}

export default async function MyVolunteerCommitmentsPage() {
  const supabase = await createSessionClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/member/volunteer/mine");
  }

  const { data: profileRows, error: profilesError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .eq("account_owner_id", user.id);

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const nameById = new Map((profileRows ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`]));

  // Deliberately NOT filtered to `.is("cancelled_at", null)` any more.
  //
  // A staff-cancelled signup that is simply dropped from this query vanishes
  // from the member's dashboard with no trace and no explanation — they turn
  // up to a shift that no longer exists, or quietly stop being asked and never
  // learn why. Since nothing emails them (see
  // supabase/migrations/20260901_volunteer_staff_cancellation.sql), this page
  // is the only place the club's side of that conversation exists.
  //
  // Cancelled rows are partitioned in TypeScript below rather than fetched in
  // a second query: it is one round trip, and the member's own signup list is
  // small by construction (RLS scopes it to their account).
  const { data: signups, error } = await supabase
    .from("volunteer_signups")
    .select(
      "id, attendee_profile_id, attendee_name, cancelled_at, cancelled_reason, volunteer_slots(role_name, start_at, events(id, title))"
    )
    .eq("account_id", user.id)
    .returns<CommitmentRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  const rows = (signups ?? []).filter((s) => s.volunteer_slots?.events);

  // A member's OWN cancellation stays invisible, exactly as before — they
  // pressed the button, they know. Only a cancellation the club made is
  // surfaced, and only while it is still something they could have shown up
  // for; see isStaffCancelled / isCancellationInScope for why the test is
  // `cancelled_reason`, not `cancelled_by`.
  const commitments = rows.filter((s) => s.cancelled_at === null);
  const cancelledByClub = rows.filter(
    (s) => isStaffCancelled(s) && isCancellationInScope(s.volunteer_slots?.start_at ?? null)
  );
  cancelledByClub.sort((a, b) => (b.cancelled_at ?? "").localeCompare(a.cancelled_at ?? ""));
  commitments.sort((a, b) => {
    const at = a.volunteer_slots?.start_at ?? "";
    const bt = b.volunteer_slots?.start_at ?? "";
    return at.localeCompare(bt);
  });

  // Split by the same "still upcoming" cutoff the volunteer list page uses,
  // so "No upcoming commitments" is actually true rather than showing a
  // shift from last season forever. A slot with no start_at (both bounds
  // left blank by the coach) counts as upcoming — there's no date to say
  // otherwise, and burying an undated commitment under "Past" would be
  // actively misleading.
  const cutoff = upcomingCutoffIso();
  const upcoming = commitments.filter((s) => {
    const startAt = s.volunteer_slots?.start_at;
    return !startAt || startAt >= cutoff;
  });
  const past = commitments.filter((s) => {
    const startAt = s.volunteer_slots?.start_at;
    return startAt && startAt < cutoff;
  });

  // Best-effort, after the reads — see the comment on the action. Clearing the
  // unread badge is the one thing this page owes the dashboard, and it must
  // happen whether or not there is anything cancelled to show, or a member who
  // visits once while a notice is pending and again after would be badged
  // forever.
  await markVolunteerCancellationsSeen();

  return (
    <Section>
      <Eyebrow>Volunteer</Eyebrow>
      <h1 className="mt-4 text-[clamp(32px,5vw,56px)] leading-[1.05]">My commitments</h1>

      {/* Season hours intentionally omitted: attendance review and the
          volunteer_hours rollup don't exist until M4 (see VOLUNTEERS.md D6),
          so there's nothing real to show yet. */}
      <p className="text-sm text-mute mt-3">Hours tracking is coming in a future update.</p>

      <StripRule className="mt-10 mb-8" />

      {/* Above the live list, not below it: this is the one thing on the page
          the member did not already know. Styled as a notice rather than a
          list row so it cannot be mistaken for a shift they are still on. */}
      {cancelledByClub.length > 0 && (
        <div className="max-w-2xl mb-10 border border-red-200 bg-red-50/60 rounded-[4px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-700">
            Cancelled by DMFC
          </p>
          <p className="text-sm text-mute mt-2 leading-relaxed">
            {cancelledByClub.length === 1
              ? "This shift was cancelled by the club. You don't need to come."
              : "These shifts were cancelled by the club. You don't need to come."}
          </p>
          <ul className="divide-y divide-red-200 mt-4">
            {cancelledByClub.map((s) => (
              <li key={s.id} className="py-4 first:pt-0 last:pb-0">
                <p className="font-semibold text-ink">
                  {s.volunteer_slots?.role_name} — {s.volunteer_slots?.events?.title}
                </p>
                <p className="text-sm text-mute mt-0.5 tabular">
                  {formatDateTime(s.volunteer_slots?.start_at ?? null)} ·{" "}
                  {attendeeLabel(s, nameById)}
                </p>
                <p className="text-sm text-ink mt-2">
                  <span className="text-mute">Reason: </span>
                  {s.cancelled_reason}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-mute mt-4 leading-relaxed">
            Questions? Contact the club directly — this notice is not an email, and no one has
            written to you separately.
          </p>
        </div>
      )}

      {upcoming.length === 0 ? (
        <p className="text-mute">
          No upcoming commitments.{" "}
          <Link href="/member/volunteer" className="text-purple-700 hover:text-purple-900 underline">
            Browse open requests
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-rule max-w-2xl">
          {upcoming.map((s) => (
            <CommitmentRowItem key={s.id} signup={s} nameById={nameById} />
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <>
          <h2 className="text-[clamp(20px,2.5vw,26px)] leading-tight mt-16 mb-6">Past</h2>
          <ul className="divide-y divide-rule max-w-2xl opacity-70">
            {past.map((s) => (
              <CommitmentRowItem key={s.id} signup={s} nameById={nameById} />
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

function CommitmentRowItem({
  signup,
  nameById,
}: {
  signup: CommitmentRow;
  nameById: Map<string, string>;
}) {
  const slot = signup.volunteer_slots;
  const event = slot?.events;
  const attendee = attendeeLabel(signup, nameById);
  return (
    <li className="py-5">
      <Link
        href={event ? `/member/volunteer/${event.id}` : "/member/volunteer"}
        className="group flex items-center justify-between gap-6 hover:text-purple-700 transition-colors"
      >
        <div>
          <p className="font-semibold text-ink group-hover:text-purple-700 transition-colors">
            {slot?.role_name} — {event?.title}
          </p>
          <p className="text-sm text-mute mt-0.5 tabular">
            {formatDateTime(slot?.start_at ?? null)} · {attendee}
          </p>
        </div>
        <span aria-hidden="true" className="text-brass text-lg flex-shrink-0">
          &#8594;
        </span>
      </Link>
    </li>
  );
}

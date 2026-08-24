import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSessionClient } from "@/lib/supabase-server";
import { Section } from "@/components/Section";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { upcomingCutoffIso } from "@/lib/volunteer/datetime";

export const metadata: Metadata = {
  title: "My Volunteer Commitments",
};

type CommitmentRow = {
  id: string;
  attendee_profile_id: string | null;
  attendee_name: string | null;
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
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

  const { data: signups, error } = await supabase
    .from("volunteer_signups")
    .select(
      "id, attendee_profile_id, attendee_name, volunteer_slots(role_name, start_at, events(id, title))"
    )
    .eq("account_id", user.id)
    .is("cancelled_at", null)
    .returns<CommitmentRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  const commitments = (signups ?? []).filter((s) => s.volunteer_slots?.events);
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

  return (
    <Section>
      <Eyebrow>Volunteer</Eyebrow>
      <h1 className="mt-4 text-[clamp(32px,5vw,56px)] leading-[1.05]">My commitments</h1>

      {/* Season hours intentionally omitted: attendance review and the
          volunteer_hours rollup don't exist until M4 (see VOLUNTEERS.md D6),
          so there's nothing real to show yet. */}
      <p className="text-sm text-mute mt-3">Hours tracking is coming in a future update.</p>

      <StripRule className="mt-10 mb-8" />

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
  const attendee = signup.attendee_profile_id
    ? nameById.get(signup.attendee_profile_id) ?? "Someone on your account"
    : signup.attendee_name ?? "Someone else";
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

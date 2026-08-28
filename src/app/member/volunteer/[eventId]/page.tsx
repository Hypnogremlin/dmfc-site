import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSessionClient } from "@/lib/supabase-server";
import { Section } from "@/components/Section";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { SlotCard } from "@/components/volunteer/SlotCard";
import { candidatesFor, type CandidateProfile } from "@/lib/volunteer/candidates";
import type { VolunteerEvent, VolunteerSlot } from "@/lib/volunteer/types";

export const metadata: Metadata = {
  title: "Volunteer",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonthShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short" });
}

function formatDayNumber(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric" });
}

export default async function VolunteerEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createSessionClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/member/volunteer/${eventId}`);
  }

  const { data: eventRow, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();

  // A DB error is not "not found" — throw, don't fall through to notFound().
  // Same distinction already drawn in member/page.tsx and the staff edit page.
  if (eventError) {
    throw new Error(eventError.message);
  }

  const event = eventRow as VolunteerEvent | null;

  // RLS already hides unpublished events from a plain member, so a NULL row
  // here means "doesn't exist or isn't published to you" either way —
  // notFound() is the right response for both.
  if (!event || !event.published) {
    notFound();
  }

  const { data: slotRows, error: slotsError } = await supabase
    .from("volunteer_slots")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .returns<VolunteerSlot[]>();

  if (slotsError) {
    throw new Error(slotsError.message);
  }
  const slots = slotRows ?? [];
  const slotIds = slots.map((s) => s.id);

  const { data: profileRows, error: profilesError } = await supabase
    .from("profiles")
    .select(
      "id, person_type, first_name, last_name, birthday, contact_phone, guardian_first_name, guardian_last_name, guardian_relationship, guardian_phone"
    )
    .eq("account_owner_id", user.id)
    .returns<CandidateProfile[]>();

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const profiles = profileRows ?? [];
  const candidates = candidatesFor(profiles);
  const nameById = new Map(profiles.map((p) => [p.id, `${p.first_name} ${p.last_name}`]));

  const { data: mySignupRows, error: mySignupsError } =
    slotIds.length > 0
      ? await supabase
          .from("volunteer_signups")
          .select("id, slot_id, attendee_profile_id, attendee_name")
          .eq("account_id", user.id)
          .in("slot_id", slotIds)
          .is("cancelled_at", null)
      : { data: [], error: null };

  if (mySignupsError) {
    throw new Error(mySignupsError.message);
  }

  // The member's own SELECT policy on volunteer_signups is scoped to
  // account_id = auth.uid() (by design — one household can't browse who else
  // signed up), so counting filled seats with the session client would only
  // ever count the member's own rows. slot_fill_counts() is a SECURITY
  // DEFINER RPC that returns per-slot counts only — no identities — closing
  // that gap without widening what a member can read directly.
  const { data: fillRows, error: fillError } = await supabase.rpc("slot_fill_counts", {
    p_event_id: eventId,
  });

  if (fillError) {
    throw new Error(fillError.message);
  }

  // No generated-types file exists in this repo (see the hand-typed
  // convention throughout src/lib/volunteer/types.ts), so — like every other
  // Supabase call in this file — the RPC's result is cast rather than
  // inferred. `.returns<T[]>()` was tried first but supabase-js's own type
  // guard rejects it here since this session client carries no Database
  // generic to confirm the RPC returns a set rather than a single row.
  const typedFillRows = (fillRows ?? []) as { slot_id: string; taken: number }[];
  const filledCounts = new Map(typedFillRows.map((r) => [r.slot_id, r.taken]));

  const mySignupsBySlot = new Map<
    string,
    { id: string; label: string; profileId: string | null }[]
  >();
  for (const row of mySignupRows ?? []) {
    const label = row.attendee_profile_id
      ? nameById.get(row.attendee_profile_id) ?? "Someone on your account"
      : row.attendee_name ?? "Someone else";
    const list = mySignupsBySlot.get(row.slot_id) ?? [];
    list.push({ id: row.id, label, profileId: row.attendee_profile_id });
    mySignupsBySlot.set(row.slot_id, list);
  }

  return (
    <Section>
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-8 items-start">
        <div className="flex-shrink-0">
          <div className="text-brass text-xs font-semibold uppercase tracking-[0.14em]">
            {formatMonthShort(event.starts_at)}
          </div>
          <div className="font-display text-[clamp(56px,8vw,88px)] leading-[0.9] text-ink tabular">
            {formatDayNumber(event.starts_at)}
          </div>
        </div>
        <div>
          <Eyebrow>Volunteer</Eyebrow>
          <h1 className="mt-4 text-[clamp(32px,5vw,56px)] leading-[1.05]">{event.title}</h1>
          <p className="text-mute mt-2 tabular">
            {formatDate(event.starts_at)}
            {event.location ? ` · ${event.location}` : ""}
          </p>
          {event.description && <p className="text-ink mt-4 max-w-2xl">{event.description}</p>}
        </div>
      </div>

      <StripRule className="mt-10 mb-8" />

      {slots.length === 0 ? (
        <p className="text-mute">No volunteer roles posted for this event yet.</p>
      ) : (
        <div className="flex flex-col gap-4 max-w-2xl">
          {slots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              filled={filledCounts.get(slot.id) ?? 0}
              candidates={candidates}
              mySignups={mySignupsBySlot.get(slot.id) ?? []}
            />
          ))}
        </div>
      )}
    </Section>
  );
}

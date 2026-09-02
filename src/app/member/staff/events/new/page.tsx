import type { Metadata } from "next";
import { createSessionClient } from "@/lib/supabase-server";
import { Section } from "@/components/Section";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { EventForm } from "../EventForm";
import {
  duplicateEventDraft,
  duplicateSlotDraft,
  type EventDraft,
  type VolunteerEvent,
  type VolunteerSlot,
  type VolunteerSlotDraft,
} from "@/lib/volunteer/types";

type DuplicateEventSource = Pick<VolunteerEvent, "title" | "description" | "location">;
type DuplicateSlotSource = Pick<VolunteerSlot, "role_name" | "notes" | "capacity" | "adults_only">;

export const metadata: Metadata = {
  title: "New Volunteer Event",
};

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string }>;
}) {
  const { duplicateFrom } = await searchParams;

  let initialEvent: EventDraft | undefined;
  let initialSlots: VolunteerSlotDraft[] | undefined;

  // "Duplicate" pre-fill (VOLUNTEERS.md M2 decisions): a read-only fetch of
  // an existing event's content, reusing the same createEvent action on
  // submit — no separate mutation exists for this. Dates are intentionally
  // dropped (see duplicateEventDraft/duplicateSlotDraft), so the new event
  // always lands as an unpublished draft with its own date, regardless of
  // the source event's published state.
  if (duplicateFrom) {
    const supabase = await createSessionClient();

    const { data: source } = await supabase
      .from("events")
      .select("title, description, location")
      .eq("id", duplicateFrom)
      .maybeSingle();

    const typedSource = source as DuplicateEventSource | null;

    if (typedSource) {
      initialEvent = duplicateEventDraft(typedSource);

      const { data: sourceSlots } = await supabase
        .from("volunteer_slots")
        .select("role_name, notes, capacity, adults_only")
        .eq("event_id", duplicateFrom)
        .order("sort_order", { ascending: true })
        .returns<DuplicateSlotSource[]>();

      initialSlots = (sourceSlots ?? []).map(duplicateSlotDraft);
    }
  }

  return (
    <Section>
      <Eyebrow>Staff</Eyebrow>
      <h1 className="mt-4 text-[clamp(32px,5vw,56px)] leading-[1.05]">New event</h1>
      <StripRule className="mt-8 mb-10" />
      <div className="max-w-2xl">
        <EventForm mode="create" initialEvent={initialEvent} initialSlots={initialSlots} />
      </div>
    </Section>
  );
}

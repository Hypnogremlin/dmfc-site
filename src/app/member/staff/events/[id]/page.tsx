import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createSessionClient } from "@/lib/supabase-server";
import { Section } from "@/components/Section";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { EventForm } from "../EventForm";
import { eventToDraft, slotToDraft, type VolunteerEvent, type VolunteerSlot } from "@/lib/volunteer/types";

export const metadata: Metadata = {
  title: "Edit Volunteer Event",
};

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSessionClient();

  const { data: eventRow, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  // A DB error is not "not found" — surface it instead of silently falling
  // through to notFound(), which would misreport an outage (or, before the
  // M2 migration is applied, an undefined-table error) as "this event
  // doesn't exist." Mirrors the same distinction already drawn in
  // src/app/member/page.tsx.
  if (eventError) {
    throw new Error(eventError.message);
  }

  const event = eventRow as VolunteerEvent | null;

  if (!event) {
    notFound();
  }

  const { data: slots, error: slotsError } = await supabase
    .from("volunteer_slots")
    .select("*")
    .eq("event_id", id)
    .order("sort_order", { ascending: true })
    .returns<VolunteerSlot[]>();

  if (slotsError) {
    throw new Error(slotsError.message);
  }

  return (
    <Section>
      <Eyebrow>Staff</Eyebrow>
      <h1 className="mt-4 text-[clamp(32px,5vw,56px)] leading-[1.05]">{event.title}</h1>
      <StripRule className="mt-8 mb-10" />
      <div className="max-w-2xl">
        <EventForm
          mode="edit"
          eventId={event.id}
          initialEvent={eventToDraft(event)}
          initialSlots={(slots ?? []).map(slotToDraft)}
          published={event.published}
        />
      </div>
    </Section>
  );
}

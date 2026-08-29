import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase-server";
import { Section } from "@/components/Section";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { PrintRosterButton } from "@/components/volunteer/PrintRosterButton";
import type { VolunteerEvent, VolunteerSlot } from "@/lib/volunteer/types";

export const metadata: Metadata = {
  title: "Volunteer Roster",
};

type RosterRow = {
  slot_id: string;
  signup_id: string;
  attendee_name: string;
  attendee_phone: string | null;
  notes: string | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeRange(startAt: string | null, endsAt: string | null): string | null {
  if (!startAt) return null;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return endsAt ? `${fmt(startAt)} – ${fmt(endsAt)}` : fmt(startAt);
}

export default async function EventRosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSessionClient();

  // Same "throw on a real DB error, notFound() only for a genuine missing
  // row" distinction as the sibling edit page — see its comment for why.
  const { data: eventRow, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (eventError) {
    throw new Error(eventError.message);
  }

  const event = eventRow as VolunteerEvent | null;

  if (!event) {
    notFound();
  }

  const { data: slotRows, error: slotsError } = await supabase
    .from("volunteer_slots")
    .select("*")
    .eq("event_id", id)
    .order("sort_order", { ascending: true })
    .returns<VolunteerSlot[]>();

  if (slotsError) {
    throw new Error(slotsError.message);
  }

  const slots = slotRows ?? [];

  // Plain `volunteer_signups` policy already lets coach+ read every row for
  // this event, but not the attendee's name — profiles has no coach-level
  // read policy (see the 20260829 migration's header). event_roster() is
  // the SECURITY DEFINER RPC that resolves identities for exactly this
  // screen, without opening a general profiles-read grant for coach+.
  const { data: rosterRows, error: rosterError } = await supabase.rpc("event_roster", {
    p_event_id: id,
  });

  if (rosterError) {
    throw new Error(rosterError.message);
  }

  const roster = (rosterRows ?? []) as RosterRow[];
  const bySlot = new Map<string, RosterRow[]>();
  for (const row of roster) {
    const list = bySlot.get(row.slot_id) ?? [];
    list.push(row);
    bySlot.set(row.slot_id, list);
  }

  return (
    <Section className="print:py-0">
      <div className="flex items-start justify-between gap-4 flex-wrap print:hidden">
        <div>
          <Eyebrow>Staff · Roster</Eyebrow>
          <Link
            href={`/member/staff/events/${event.id}`}
            className="block mt-2 text-sm text-mute hover:text-ink underline transition-colors"
          >
            ← Back to event
          </Link>
        </div>
        <PrintRosterButton />
      </div>

      <h1 className="mt-4 text-[clamp(32px,5vw,56px)] leading-[1.05]">{event.title}</h1>
      <p className="text-mute mt-2 tabular">
        {formatDate(event.starts_at)}
        {event.location ? ` · ${event.location}` : ""}
      </p>

      <StripRule className="mt-8 mb-10" />

      {slots.length === 0 ? (
        <p className="text-mute">No volunteer roles posted for this event.</p>
      ) : (
        <div className="flex flex-col gap-8 max-w-2xl print:max-w-none">
          {slots.map((slot) => {
            const signups = bySlot.get(slot.id) ?? [];
            const timeRange = formatTimeRange(slot.start_at, slot.ends_at);
            return (
              <div
                key={slot.id}
                className="border border-brass/25 rounded-[4px] p-6 print:border-black/40 print:break-inside-avoid"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-semibold text-ink">{slot.role_name}</p>
                    {timeRange && <p className="text-sm text-mute tabular mt-0.5">{timeRange}</p>}
                    {slot.notes && <p className="text-sm text-mute mt-1">{slot.notes}</p>}
                  </div>
                  <span className="text-sm text-mute tabular flex-shrink-0">
                    {signups.length} of {slot.capacity} filled
                  </span>
                </div>

                {signups.length === 0 ? (
                  <p className="text-sm text-mute mt-4">No one signed up yet.</p>
                ) : (
                  <table className="w-full mt-4 text-sm">
                    <thead>
                      <tr className="text-left text-mute border-b border-rule">
                        <th className="font-medium pb-1 pr-4">Name</th>
                        <th className="font-medium pb-1 pr-4">Phone</th>
                        {/* Signup-level notes (volunteer_signups.notes) has no
                            write path anywhere in the app yet — nothing lets a
                            volunteer leave one at signup time — so this column
                            would always read "—". A blank signature line is
                            actually useful on a printed sheet; an always-empty
                            column isn't. */}
                        <th className="font-medium pb-1 hidden print:table-cell">Signature</th>
                      </tr>
                    </thead>
                    <tbody>
                      {signups.map((row) => (
                        <tr key={row.signup_id} className="border-b border-rule last:border-0">
                          <td className="py-2 pr-4 text-ink">{row.attendee_name}</td>
                          <td className="py-2 pr-4 text-mute tabular">
                            {row.attendee_phone ?? "—"}
                          </td>
                          <td className="py-2 hidden print:table-cell">
                            <span className="inline-block w-full border-b border-black/30">
                              &nbsp;
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

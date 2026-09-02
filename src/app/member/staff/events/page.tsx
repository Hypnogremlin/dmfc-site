import Link from "next/link";
import type { Metadata } from "next";
import { createSessionClient } from "@/lib/supabase-server";
import { Section } from "@/components/Section";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { Button } from "@/components/Button";
import { formatClubDate as formatDate } from "@/lib/volunteer/datetime";
import type { VolunteerEvent } from "@/lib/volunteer/types";

export const metadata: Metadata = {
  title: "Staff — Volunteer Events",
};

type EventRow = Pick<VolunteerEvent, "id" | "title" | "starts_at" | "published">;

export default async function StaffEventsPage() {
  const supabase = await createSessionClient();

  // RLS already limits writes to coach+ (see the M2 migration); the layout
  // gate at src/app/member/staff/layout.tsx keeps a member from reaching
  // this page at all. This SELECT sees drafts too because the viewer is
  // coach+ — see the "Coaches and above see all events" policy.
  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, starts_at, published")
    .order("starts_at", { ascending: false })
    .returns<EventRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  return (
    <Section>
      <Eyebrow>Staff</Eyebrow>
      <div className="flex items-end justify-between gap-4 flex-wrap mt-4">
        <h1 className="text-[clamp(32px,5vw,56px)] leading-[1.05]">Volunteer events</h1>
        <Button as="link" href="/member/staff/events/new" arrow="none" variant="primary">
          + New event
        </Button>
      </div>

      <StripRule className="mt-12 mb-8" />

      {!events || events.length === 0 ? (
        <p className="text-mute">No events yet.</p>
      ) : (
        <ul className="divide-y divide-rule max-w-3xl">
          {events.map((event) => (
            <li key={event.id} className="py-5 flex items-center justify-between gap-6">
              <Link
                href={`/member/staff/events/${event.id}/roster`}
                className="group flex-1 flex items-center justify-between gap-6 hover:text-purple-700 transition-colors"
              >
                <div>
                  <p className="font-semibold text-ink group-hover:text-purple-700 transition-colors">
                    {event.title}
                  </p>
                  <p className="text-sm text-mute mt-0.5 tabular">{formatDate(event.starts_at)}</p>
                </div>
                <span
                  className={`inline-flex items-center px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] rounded-[2px] flex-shrink-0 ${
                    event.published ? "bg-brass text-ink" : "border border-mute/40 text-mute"
                  }`}
                >
                  {event.published ? "Published" : "Draft"}
                </span>
              </Link>
              <Link
                href={`/member/staff/events/${event.id}`}
                className="text-sm text-mute hover:text-ink underline transition-colors flex-shrink-0"
              >
                Edit
              </Link>
              <Link
                href={`/member/staff/events/new?duplicateFrom=${event.id}`}
                className="text-sm text-mute hover:text-ink underline transition-colors flex-shrink-0"
              >
                Duplicate
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

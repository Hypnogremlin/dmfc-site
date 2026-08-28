import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSessionClient } from "@/lib/supabase-server";
import { Section } from "@/components/Section";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { markVolunteerSeen } from "./actions";
import { upcomingCutoffIso } from "@/lib/volunteer/datetime";
import type { VolunteerEvent } from "@/lib/volunteer/types";

export const metadata: Metadata = {
  title: "Volunteer",
  description: "Upcoming volunteer requests at Des Moines Fencing Club.",
};

type EventRow = Pick<VolunteerEvent, "id" | "title" | "starts_at" | "location">;

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

export default async function VolunteerListPage() {
  const supabase = await createSessionClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/member/volunteer");
  }

  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, starts_at, location")
    .eq("published", true)
    .gte("starts_at", upcomingCutoffIso())
    .order("starts_at", { ascending: true })
    .returns<EventRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  // Best-effort — see the comment on markVolunteerSeen() in actions.ts.
  // Failure here must not block the page from rendering.
  await markVolunteerSeen();

  return (
    <Section>
      <Eyebrow>Volunteer</Eyebrow>
      <div className="flex items-end justify-between gap-4 flex-wrap mt-4">
        <h1 className="text-[clamp(32px,5vw,56px)] leading-[1.05]">Volunteer requests</h1>
        <Link
          href="/member/volunteer/mine"
          className="text-sm font-semibold text-purple-700 hover:text-purple-900 transition-colors"
        >
          My commitments →
        </Link>
      </div>

      <StripRule className="mt-12 mb-8" />

      {!events || events.length === 0 ? (
        <p className="text-mute">No open volunteer requests right now — check back soon.</p>
      ) : (
        <ul className="divide-y divide-brass/25 max-w-3xl">
          {events.map((event) => (
            <li key={event.id} className="py-5">
              <Link
                href={`/member/volunteer/${event.id}`}
                className="group flex items-center gap-6 hover:text-purple-700 transition-colors"
              >
                <div className="flex-shrink-0 w-16 text-center">
                  <div className="text-brass text-[10px] font-semibold uppercase tracking-[0.14em]">
                    {formatMonthShort(event.starts_at)}
                  </div>
                  <div className="font-display text-4xl leading-none text-ink tabular">
                    {formatDayNumber(event.starts_at)}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-ink group-hover:text-purple-700 transition-colors">
                    {event.title}
                  </p>
                  <p className="text-sm text-mute mt-0.5 tabular">
                    {formatDate(event.starts_at)}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
                <span aria-hidden="true" className="text-brass text-lg flex-shrink-0">
                  &#8594;
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

import Link from "next/link";
import { formatDateLong, type TournamentEntry } from "@/lib/news";

// "Loud" home-page treatment for the next upcoming tournament. Deliberately
// distinct from the TournamentFacts block on the detail page: this one is a
// single feature card meant to catch the eye mid-scroll, with an oversized
// Fraunces date as the visual anchor and brass framing on three sides.
export function NextTournamentCard({ entry }: { entry: TournamentEntry }) {
  const weaponLabels: Record<TournamentEntry["weapons"][number], string> = {
    foil: "Foil",
    epee: "Épée",
    saber: "Saber",
  };
  const monthShort = new Date(entry.date + "T12:00:00Z").toLocaleDateString(
    "en-US",
    { month: "short", timeZone: "UTC" }
  );
  const dayNum = new Date(entry.date + "T12:00:00Z").toLocaleDateString(
    "en-US",
    { day: "numeric", timeZone: "UTC" }
  );

  return (
    <Link
      href={`/news/${entry.slug}`}
      className="group relative block border-2 border-brass bg-paper hover:bg-purple-50/50 transition-colors"
    >
      {/* Decorative brass corner ticks — reinforce the framing without weight */}
      <span
        aria-hidden="true"
        className="absolute -top-px -left-px h-3 w-3 border-t-2 border-l-2 border-brass"
      />
      <span
        aria-hidden="true"
        className="absolute -top-px -right-px h-3 w-3 border-t-2 border-r-2 border-brass"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-px -left-px h-3 w-3 border-b-2 border-l-2 border-brass"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-px -right-px h-3 w-3 border-b-2 border-r-2 border-brass"
      />

      <div className="grid grid-cols-12 gap-6 md:gap-10 items-center p-8 md:p-12">
        <div className="col-span-12 md:col-span-3">
          <div className="text-brass text-[10px] font-semibold uppercase tracking-[0.16em] mb-2">
            {monthShort}
          </div>
          <div className="font-display text-[clamp(80px,10vw,140px)] leading-[0.85] text-ink tabular">
            {dayNum}
          </div>
          <div className="tabular text-mute text-sm mt-2">
            {formatDateLong(entry.date)}
          </div>
        </div>

        <div className="col-span-12 md:col-span-9">
          <div className="text-brass text-[10px] font-semibold uppercase tracking-[0.16em]">
            Next tournament
          </div>
          <h3 className="font-display text-3xl md:text-5xl text-ink leading-[1.05] mt-3 group-hover:text-purple-700 transition-colors">
            {entry.title}
          </h3>
          <p className="text-ink/75 mt-4 leading-relaxed max-w-xl">
            {entry.excerpt}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-ink">
              <span className="text-mute uppercase tracking-wider text-[10px] mr-2">
                Weapons
              </span>
              {entry.weapons.map((w) => weaponLabels[w]).join(" · ")}
            </span>
            <span className="text-ink">
              <span className="text-mute uppercase tracking-wider text-[10px] mr-2">
                Location
              </span>
              {entry.location}
            </span>
          </div>
          <span className="inline-block mt-6 text-sm font-semibold uppercase tracking-[0.08em] text-purple-700 underline-draw">
            View details →
          </span>
        </div>
      </div>
    </Link>
  );
}

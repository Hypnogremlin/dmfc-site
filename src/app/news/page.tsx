import Link from "next/link";
import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { NewsTypeBadge } from "@/components/NewsTypeBadge";
import { FeatureImage } from "@/components/FeatureImage";
import { getAllEntries, formatDateLong } from "@/lib/news";

export const metadata: Metadata = {
  title: "News & Tournaments | Des Moines Fencing Club",
  description:
    "Announcements, club updates, and tournament information from the Des Moines Fencing Club.",
};

export default function NewsIndexPage() {
  const entries = getAllEntries();

  return (
    <Section>
      <div className="grid grid-cols-12 gap-6 items-center">
        <div className="col-span-12 md:col-span-7">
          <Eyebrow>From the club</Eyebrow>
          <h1 className="text-5xl md:text-6xl mt-3">News &amp; Tournaments</h1>
          <p className="text-ink/75 text-lg mt-5 leading-relaxed">
            Club announcements, schedule changes, and information on our four
            annual tournaments. Tournament entries are tagged so you can spot
            them in the list below.
          </p>
        </div>
        <div className="col-span-12 md:col-span-5 md:col-start-8 mt-8 md:mt-0">
          <FeatureImage
            src="/img/news.jpg"
            alt="A club fencer receiving a tournament medal"
            priority
            aspect="aspect-[4/3]"
          />
        </div>
      </div>

      <StripRule className="mt-12 mb-12" />

      {entries.length === 0 ? (
        <p className="text-mute italic">No entries yet — check back soon.</p>
      ) : (
        <ul className="divide-y divide-rule">
          {entries.map((entry) => (
            <li key={entry.slug}>
              <Link
                href={`/news/${entry.slug}`}
                className="group grid grid-cols-12 gap-6 py-8 items-start hover:bg-purple-50/40 transition-colors -mx-4 px-4 rounded-sm"
              >
                <div className="col-span-12 md:col-span-3">
                  <div className="tabular text-mute text-sm">
                    {formatDateLong(entry.date)}
                  </div>
                  <div className="mt-2">
                    <NewsTypeBadge type={entry.type} />
                  </div>
                </div>
                <div className="col-span-12 md:col-span-9">
                  <h2 className="font-display text-2xl md:text-3xl text-ink leading-tight group-hover:text-purple-700 transition-colors">
                    {entry.title}
                  </h2>
                  <p className="text-ink/75 mt-3 leading-relaxed">
                    {entry.excerpt}
                  </p>
                  <span className="inline-block mt-3 text-sm font-semibold text-purple-700 underline-draw">
                    Read more →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

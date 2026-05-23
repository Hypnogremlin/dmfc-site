import Link from "next/link";
import { formatDateLong, type NewsEntry } from "@/lib/news";

// Compact three-up teaser for the "Latest news" row on the home page.
// Quieter than the NextTournamentCard — these are general announcements,
// not time-critical events. Hover reveals the brass underline on the title.
export function NewsTeaser({ entry }: { entry: NewsEntry }) {
  return (
    <Link
      href={`/news/${entry.slug}`}
      className="group block border-t border-brass/40 pt-6 hover:border-brass transition-colors"
    >
      <div className="tabular text-mute text-xs uppercase tracking-wider">
        {formatDateLong(entry.date)}
      </div>
      <h3 className="font-display text-xl md:text-2xl text-ink leading-tight mt-3 group-hover:text-purple-700 transition-colors">
        {entry.title}
      </h3>
      <p className="text-ink/75 text-sm mt-3 leading-relaxed">
        {entry.excerpt}
      </p>
      <span className="inline-block mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-purple-700 underline-draw">
        Read more →
      </span>
    </Link>
  );
}

import type { NewsType } from "@/lib/news";

// Small chip rendered in the news list (and on detail pages) so a visitor
// can tell at a glance whether an entry is a tournament or general news.
// Tournament gets the brass-tinted treatment; announcements are quieter.
export function NewsTypeBadge({ type }: { type: NewsType }) {
  if (type === "tournament") {
    return (
      <span className="inline-flex items-center gap-1.5 border border-brass/60 bg-brass/10 text-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] rounded-sm">
        <span className="h-1 w-1 rounded-full bg-brass" />
        Tournament
      </span>
    );
  }
  return (
    <span className="inline-flex items-center border border-rule text-mute px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] rounded-sm">
      News
    </span>
  );
}

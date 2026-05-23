import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { NewsTypeBadge } from "@/components/NewsTypeBadge";
import { TournamentFacts } from "@/components/TournamentFacts";
import {
  getAllEntries,
  getEntry,
  getEntryBasename,
  formatDateLong,
} from "@/lib/news";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllEntries().map((entry) => ({ slug: entry.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry(slug);
  if (!entry) return {};
  return {
    title: `${entry.title} | Des Moines Fencing Club`,
    description: entry.excerpt,
  };
}

export default async function NewsEntryPage({ params }: PageProps) {
  const { slug } = await params;
  const entry = getEntry(slug);
  const basename = getEntryBasename(slug);
  if (!entry || !basename) notFound();

  // `.mdx` is pinned in the template literal — Turbopack needs this to
  // restrict its directory glob to MDX files (otherwise README.md and
  // other non-MDX siblings crash the build).
  const { default: MdxBody } = await import(
    `@/../content/news/${basename}.mdx`
  );

  return (
    <Section>
      <article className="max-w-3xl mx-auto">
        <Link
          href="/news"
          className="text-sm text-mute hover:text-purple-700 underline-draw"
        >
          ← All news
        </Link>

        <header className="mt-8">
          <div className="flex items-center gap-3">
            <NewsTypeBadge type={entry.type} />
            <span className="tabular text-mute text-sm">
              {formatDateLong(entry.date)}
            </span>
          </div>
          <Eyebrow className="mt-6 block">
            {entry.type === "tournament" ? "Tournament" : "Announcement"}
          </Eyebrow>
          <h1 className="text-4xl md:text-6xl mt-3 leading-[1.05]">
            {entry.title}
          </h1>
          <p className="text-ink/75 text-lg mt-5 leading-relaxed">
            {entry.excerpt}
          </p>
        </header>

        {entry.type === "tournament" && <TournamentFacts entry={entry} />}

        {entry.type !== "tournament" && <StripRule className="my-10" />}

        <div className="prose-body">
          <MdxBody />
        </div>
      </article>
    </Section>
  );
}

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

// Server-side news content loader. Globs MDX files under `content/news/`,
// parses YAML frontmatter, validates required fields, and exposes the
// metadata to list and detail pages. The MDX *body* is loaded separately
// in the detail page via dynamic `import()` so it can be compiled by
// @next/mdx — this loader only touches metadata.

const NEWS_DIR = path.join(process.cwd(), "content", "news");

export type NewsType = "tournament" | "announcement";

export interface NewsEntryBase {
  slug: string;
  title: string;
  date: string; // ISO date (YYYY-MM-DD)
  type: NewsType;
  excerpt: string;
}

export interface TournamentEntry extends NewsEntryBase {
  type: "tournament";
  location: string;
  registrationUrl?: string;
  registrationDeadline?: string;
  weapons: Array<"foil" | "epee" | "saber">;
  format?: string;
}

export interface AnnouncementEntry extends NewsEntryBase {
  type: "announcement";
}

export type NewsEntry = TournamentEntry | AnnouncementEntry;

const VALID_WEAPONS = new Set(["foil", "epee", "saber"]);

function validateAndCoerce(
  raw: Record<string, unknown>,
  filename: string
): NewsEntry {
  const fail = (msg: string): never => {
    throw new Error(`[content/news/${filename}] ${msg}`);
  };

  const title = raw.title;
  if (typeof title !== "string" || !title.trim()) {
    fail("missing or empty `title`");
  }

  const date = raw.date;
  // gray-matter parses YAML dates into Date objects; accept either.
  let dateIso: string;
  if (date instanceof Date) {
    dateIso = date.toISOString().slice(0, 10);
  } else if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    dateIso = date;
  } else {
    return fail("`date` must be YYYY-MM-DD");
  }

  const type = raw.type;
  if (type !== "tournament" && type !== "announcement") {
    fail('`type` must be "tournament" or "announcement"');
  }

  const excerpt = raw.excerpt;
  if (typeof excerpt !== "string" || !excerpt.trim()) {
    fail("missing or empty `excerpt`");
  }

  const slug =
    typeof raw.slug === "string" && raw.slug.trim()
      ? raw.slug.trim()
      : filename.replace(/\.mdx?$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");

  const base: NewsEntryBase = {
    slug,
    title: title as string,
    date: dateIso,
    type: type as NewsType,
    excerpt: excerpt as string,
  };

  if (type === "announcement") {
    return { ...base, type: "announcement" };
  }

  // Tournament-only fields.
  const location = raw.location;
  if (typeof location !== "string" || !location.trim()) {
    fail("tournament entries require `location`");
  }

  const weaponsRaw = raw.weapons;
  if (!Array.isArray(weaponsRaw) || weaponsRaw.length === 0) {
    fail("tournament entries require a non-empty `weapons` array");
  }
  const weapons = (weaponsRaw as unknown[]).map((w) => {
    if (typeof w !== "string" || !VALID_WEAPONS.has(w)) {
      fail(`invalid weapon "${String(w)}" — must be foil, epee, or saber`);
    }
    return w as "foil" | "epee" | "saber";
  });

  let registrationDeadline: string | undefined;
  if (raw.registrationDeadline instanceof Date) {
    registrationDeadline = raw.registrationDeadline.toISOString().slice(0, 10);
  } else if (typeof raw.registrationDeadline === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.registrationDeadline)) {
      fail("`registrationDeadline` must be YYYY-MM-DD");
    }
    registrationDeadline = raw.registrationDeadline;
  }

  const registrationUrl =
    typeof raw.registrationUrl === "string" && raw.registrationUrl.trim()
      ? raw.registrationUrl.trim()
      : undefined;

  const format =
    typeof raw.format === "string" && raw.format.trim()
      ? raw.format.trim()
      : undefined;

  return {
    ...base,
    type: "tournament",
    location: location as string,
    registrationUrl,
    registrationDeadline,
    weapons,
    format,
  };
}

function listMdxFiles(): string[] {
  if (!fs.existsSync(NEWS_DIR)) return [];
  return fs
    .readdirSync(NEWS_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .filter((f) => !f.startsWith("_")); // skip _templates/ collisions, etc.
  // README.md is intentionally excluded by the .mdx-only filter above.
}

export function getAllEntries(): NewsEntry[] {
  const files = listMdxFiles();
  const entries = files.map((file) => {
    const full = path.join(NEWS_DIR, file);
    const src = fs.readFileSync(full, "utf8");
    const { data } = matter(src);
    return validateAndCoerce(data, file);
  });
  // Newest first.
  return entries.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getEntry(slug: string): NewsEntry | undefined {
  return getAllEntries().find((e) => e.slug === slug);
}

/**
 * Returns the file basename (no extension) for a given slug, so the detail
 * page can do `import(`@/../content/news/${basename}.mdx`)`. Pinning the
 * `.mdx` extension in the template literal (rather than including it in
 * this return value) is what lets Turbopack's static analysis restrict
 * the dynamic-import glob to MDX files only — otherwise it tries to
 * bundle README.md and crashes the build.
 */
export function getEntryBasename(slug: string): string | undefined {
  const files = listMdxFiles();
  for (const file of files) {
    const src = fs.readFileSync(path.join(NEWS_DIR, file), "utf8");
    const { data } = matter(src);
    const entry = validateAndCoerce(data, file);
    if (entry.slug === slug) return file.replace(/\.mdx?$/, "");
  }
  return undefined;
}

export function getUpcomingTournaments(today = new Date()): TournamentEntry[] {
  const iso = today.toISOString().slice(0, 10);
  return getAllEntries()
    .filter(
      (e): e is TournamentEntry => e.type === "tournament" && e.date >= iso
    )
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function getRecentNews(withinDays = 90, today = new Date()): NewsEntry[] {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - withinDays);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return getAllEntries().filter((e) => e.date >= cutoffIso);
}

export function formatDateLong(iso: string): string {
  // "Sat, Oct 25, 2026"
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

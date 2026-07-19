# News content

This directory holds every entry that appears on the `/news` page — both
**tournaments** and **plain announcements**. There is no separate events
section: tournaments are just news entries with extra structured fields.

## Adding a new entry

1. **Copy a template.** In `_templates/`, duplicate either
   `tournament.template.mdx` or `announcement.template.mdx`.
2. **Rename the file.** Use the format `YYYY-MM-DD-short-name.mdx`, e.g.
   `2026-10-25-jack-o-lantern-open.mdx`. The date in the filename is only
   for sorting in your editor; the *real* date lives in the frontmatter.
   The slug portion (`jack-o-lantern-open` in this example) becomes the
   URL: `/news/jack-o-lantern-open`.
3. **Fill in the frontmatter and write the body.** Save, commit, push.
   Vercel deploys automatically within about a minute.

## Field reference

See the templates themselves — every field is documented inline with
comments. The build will fail loudly if a required field is missing or
malformed, so you can't accidentally publish a broken entry: at worst
your `git push` produces a failed Vercel build, and the live site keeps
showing the previous (working) version.

## Editing existing entries

Open the `.mdx` file, edit, commit, push. If you change the *filename* of
a published entry, its URL changes too — so don't rename files that are
already linked from flyers, social posts, or external sites.

## Images

### 1. Prepare the files

Don't copy photos straight off a phone into `public/` — they're 2–3MB
each and would ship to every visitor. Run them through the prep script
first (from the project root):

```
node scripts/prep-news-photos.mjs <slug> <photo files...>
```

For example:

```
node scripts/prep-news-photos.mjs iowa-games-2026 ~/Pictures/iowa/*.jpg
```

This resizes each photo to web size and writes optimized full-color
`.webp` files into `public/news-images/<slug>/`. It's compression only —
any visual treatment (like the B&W look used elsewhere on the site) is
applied with CSS at the component level, never baked into the files.
Originals are untouched; keep them wherever they live, but don't commit
them into `public/`.

### 2. Single images

Reference prepared images with a leading slash in Markdown. The quoted
title is optional and renders as a caption:

```markdown
![Alt text for screen readers](/news-images/your-slug/photo.webp "Optional caption")
```

### 3. Photo galleries

For a set of photos (tournament recaps etc.), use the `PhotoGrid`
component — available in every entry, no import needed. It renders a
thumbnail grid; clicking a photo opens a full-size lightbox:

```mdx
<PhotoGrid
  photos={[
    {
      src: "/news-images/your-slug/photo-1.webp",
      alt: "What the photo shows, for screen readers.",
      caption: "Optional caption shown in the lightbox.",
    },
    {
      src: "/news-images/your-slug/photo-2.webp",
      alt: "Every photo needs meaningful alt text.",
    },
  ]}
/>
```

`alt` is required. `caption` is optional. Image dimensions are read
automatically at build time — you never need to specify them.

See `2026-07-18-iowa-games-recap.mdx` for a real example of the full
pattern.

## Files prefixed with `_`

Files and directories whose names begin with `_` (like `_templates/`) are
ignored by the news loader. That means you can safely keep template
files here without them showing up as real entries.

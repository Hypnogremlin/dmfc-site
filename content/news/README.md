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

Put image files in `public/news-images/` and reference them with a
leading slash in Markdown:

```markdown
![Caption](/news-images/your-file.jpg)
```

## Files prefixed with `_`

Files and directories whose names begin with `_` (like `_templates/`) are
ignored by the news loader. That means you can safely keep template
files here without them showing up as real entries.

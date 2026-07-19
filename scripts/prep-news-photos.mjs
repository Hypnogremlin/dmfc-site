// Prepares photos for a news entry gallery.
//
// Usage:
//   node scripts/prep-news-photos.mjs <slug> <file...>
//
// Example:
//   node scripts/prep-news-photos.mjs iowa-games-2026 public/img/2026*.jpg
//
// For each input image this script resizes to a maximum width of 1600px
// (never upscales) and exports full-color WebP at quality 80 into
// public/news-images/<slug>/. Compression only — no visual treatment.
// If a photo needs the site's B&W imagery treatment, apply it with CSS
// filters at the component level (like CoachPortrait does), so the
// original color data stays available (owner decision, 2026-07-19).
//
// Originals are never modified or deleted. Output filenames are the input
// basename, lowercased, with a .webp extension — reference them from MDX as
// /news-images/<slug>/<name>.webp.
//
// `sharp` ships with Next.js, so there is nothing extra to install.

import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";

const MAX_WIDTH = 1600;
const QUALITY = 80;

const [slug, ...files] = process.argv.slice(2);

if (!slug || files.length === 0) {
  console.error("Usage: node scripts/prep-news-photos.mjs <slug> <file...>");
  process.exit(1);
}

const outDir = path.join("public", "news-images", slug);
fs.mkdirSync(outDir, { recursive: true });

let failed = false;
for (const file of files) {
  const base = path
    .basename(file, path.extname(file))
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  const outPath = path.join(outDir, `${base}.webp`);

  try {
    const info = await sharp(file)
      .rotate() // honor EXIF orientation from phone cameras
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(outPath);
    console.log(
      `${outPath}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)}KB`
    );
  } catch (err) {
    failed = true;
    console.error(`FAILED ${file}: ${err.message}`);
  }
}

process.exit(failed ? 1 : 0);

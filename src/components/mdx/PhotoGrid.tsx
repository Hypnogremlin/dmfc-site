import path from "node:path";
import sharp from "sharp";
import { PhotoGridClient, type SizedPhoto } from "./PhotoGridClient";

export interface PhotoGridPhoto {
  /** Path under public/, e.g. "/news-images/iowa-games-2026/photo.webp" */
  src: string;
  /** Meaningful description — required, per the accessibility floor in DESIGN.md. */
  alt: string;
  /** Optional caption shown in the lightbox. Falls back to nothing (not alt). */
  caption?: string;
}

// Photo gallery for MDX news entries. Registered globally in
// src/mdx-components.tsx, so entries can use it without an import:
//
//   <PhotoGrid photos={[
//     { src: "/news-images/<slug>/photo.webp", alt: "..." },
//   ]} />
//
// This server half measures each image with sharp at build time; the client
// half renders the grid and lightbox.
export async function PhotoGrid({ photos }: { photos: PhotoGridPhoto[] }) {
  const sized: SizedPhoto[] = await Promise.all(
    photos.map(async (photo) => {
      const file = path.join(process.cwd(), "public", photo.src);
      const { width, height } = await sharp(file).metadata();
      if (!width || !height) {
        throw new Error(`PhotoGrid: could not read dimensions of ${photo.src}`);
      }
      return { ...photo, width, height };
    })
  );
  return <PhotoGridClient photos={sized} />;
}

"use client";

import { useRef, useState } from "react";
import Image from "next/image";

export interface SizedPhoto {
  src: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
}

// Client half of PhotoGrid: an editorial thumbnail grid (uniform crops,
// hairline gaps, no rounded corners — per the card rules in DESIGN.md) with
// a native <dialog> lightbox. Esc closes via the dialog itself; arrow keys
// navigate. No transitions, so nothing to gate behind prefers-reduced-motion.
export function PhotoGridClient({ photos }: { photos: SizedPhoto[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const show = (i: number) => {
    setIndex(i);
    setOpen(true);
    dialogRef.current?.showModal();
  };
  const step = (delta: number) =>
    setIndex((i) => (i + delta + photos.length) % photos.length);

  const current = photos[index];

  return (
    <>
      <div className="my-10 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {photos.map((photo, i) => (
          <button
            key={photo.src}
            type="button"
            onClick={() => show(i)}
            aria-label={`View photo ${i + 1} of ${photos.length}: ${photo.alt}`}
            className="group relative aspect-[3/4] overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass/60"
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              className="object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          // Click on the backdrop (the dialog element itself) closes.
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
        className="m-auto max-h-[100dvh] max-w-[100vw] bg-transparent p-4 backdrop:bg-purple-950/90 sm:p-8"
      >
        {open && current && (
          <div className="flex flex-col items-center gap-3">
            <Image
              src={current.src}
              alt={current.alt}
              width={current.width}
              height={current.height}
              sizes="100vw"
              className="h-auto max-h-[80dvh] w-auto max-w-full"
            />
            <div className="flex w-full items-center justify-between gap-4 text-paper">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous photo"
                className="px-3 py-1 text-2xl leading-none hover:text-brass focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass/60"
              >
                ←
              </button>
              <p className="min-w-0 text-center text-sm text-paper/80">
                {current.caption}
                <span className="ml-2 whitespace-nowrap tabular-nums text-paper/50">
                  {index + 1} / {photos.length}
                </span>
              </p>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next photo"
                className="px-3 py-1 text-2xl leading-none hover:text-brass focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass/60"
              >
                →
              </button>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="text-xs font-semibold uppercase tracking-[0.12em] text-brass hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass/60"
            >
              Close
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}

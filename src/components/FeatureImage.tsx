import Image from "next/image";

/**
 * Full-width editorial photo band. Renders a single monochrome image at a
 * cinematic aspect ratio, matching the grayscale treatment established by
 * CoachPortrait so all club photography reads as one consistent set.
 *
 * - `aspect`    — Tailwind aspect-ratio class for the frame (default 16/9).
 * - `position`  — object-position class to keep the subject in frame when the
 *                 source is cropped (portrait sources especially).
 */
export function FeatureImage({
  src,
  alt,
  priority = false,
  aspect = "aspect-[16/9]",
  position = "object-center",
  sizes = "(max-width: 1280px) 100vw, 1280px",
  className = "",
}: {
  src: string;
  alt: string;
  priority?: boolean;
  aspect?: string;
  position?: string;
  sizes?: string;
  className?: string;
}) {
  return (
    <figure className={`relative w-full overflow-hidden ${aspect} ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={`object-cover ${position} [filter:grayscale(100%)_contrast(1.05)]`}
      />
    </figure>
  );
}

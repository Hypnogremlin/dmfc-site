import Image from "next/image";
import { Eyebrow } from "./Eyebrow";

export type CoachPortraitProps = {
  name: string;
  role?: string;
  bio?: string;
  image?: string;
  imageAlt?: string;
  className?: string;
};

export function CoachPortrait({
  name,
  role,
  bio,
  image,
  imageAlt,
  className = "",
}: CoachPortraitProps) {
  return (
    <figure className={`flex flex-col ${className}`}>
      {image ? (
        <div className="relative aspect-square w-full overflow-hidden bg-purple-50">
          {/* TODO: Replace flat grayscale with locked-in duotone/spot-color treatment
              once imagery direction is decided (see DESIGN.md — Imagery candidates). */}
          <Image
            src={image}
            alt={imageAlt ?? name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 33vw, 400px"
            className="object-cover [filter:grayscale(100%)_contrast(1.05)]"
          />
        </div>
      ) : null}
      <figcaption className={image ? "mt-5" : ""}>
        {role ? <Eyebrow>{role}</Eyebrow> : null}
        <h3 className={`${role ? "mt-2" : ""} text-2xl md:text-[28px] leading-tight text-inherit`}>
          {name}
        </h3>
        {bio ? (
          <p className="mt-3 text-sm text-mute leading-relaxed">{bio}</p>
        ) : null}
      </figcaption>
    </figure>
  );
}

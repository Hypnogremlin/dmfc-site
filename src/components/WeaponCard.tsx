import { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";

export type WeaponCardProps = {
  name: string;
  tagline: string;
  target: string;
  style: string;
  description: ReactNode;
  className?: string;
};

export function WeaponCard({
  name,
  tagline,
  target,
  style,
  description,
  className = "",
}: WeaponCardProps) {
  return (
    <article
      className={`flex flex-col h-full border border-brass/25 p-8 md:p-10 bg-transparent ${className}`}
    >
      <Eyebrow>{tagline}</Eyebrow>
      <h3 className="mt-4 font-display text-bone text-[clamp(32px,3.2vw,44px)] leading-none">
        {name}
      </h3>

      <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <dt className="text-bone/55 uppercase tracking-[0.16em] text-[11px] font-semibold pt-0.5">
          Target
        </dt>
        <dd className="text-bone/90 leading-snug">{target}</dd>
        <dt className="text-bone/55 uppercase tracking-[0.16em] text-[11px] font-semibold pt-0.5">
          Style
        </dt>
        <dd className="text-bone/90 leading-snug">{style}</dd>
      </dl>

      <div className="mt-8 h-px w-full bg-brass/30" aria-hidden="true" />

      <div className="mt-6 text-bone/80 leading-relaxed text-[15px]">
        {description}
      </div>
    </article>
  );
}

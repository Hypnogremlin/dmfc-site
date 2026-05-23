import { ReactNode } from "react";

export function StatBlock({
  value,
  label,
  className = "",
}: {
  value: ReactNode;
  label: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col ${className}`}>
      <span className="font-display text-brass text-[clamp(48px,7vw,84px)] leading-none tracking-tight">
        {value}
      </span>
      <span className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-mute">
        {label}
      </span>
    </div>
  );
}

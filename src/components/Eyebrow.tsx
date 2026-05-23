import { ReactNode } from "react";

export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`text-brass text-xs font-semibold uppercase tracking-[0.12em] ${className}`}
    >
      {children}
    </span>
  );
}

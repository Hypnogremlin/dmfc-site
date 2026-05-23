import { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border border-brass/25 p-8 md:p-12 bg-paper ${className}`}
    >
      {children}
    </div>
  );
}

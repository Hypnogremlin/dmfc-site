import { ReactNode } from "react";
import { Container } from "./Container";

export function DarkSection({
  children,
  className = "",
  bare = false,
}: {
  children: ReactNode;
  className?: string;
  bare?: boolean;
}) {
  return (
    <section
      className={`bg-purple-950 text-bone py-20 md:py-30 ${className}`}
    >
      {bare ? children : <Container>{children}</Container>}
    </section>
  );
}

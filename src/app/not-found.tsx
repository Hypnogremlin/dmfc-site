import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { StripRule } from "@/components/StripRule";
import { Button } from "@/components/Button";

export const metadata: Metadata = {
  title: "404 — Page Not Found",
};

export default function NotFound() {
  return (
    <div className="flex min-h-[75vh] items-center">
      <Container className="py-28 text-center">
        <div className="flex flex-col items-center gap-8">
          {/* Badge — SVG scales crisply at any size */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="Des Moines Fencing Club"
            width={120}
            height={120}
            className="opacity-75"
          />

          <StripRule className="w-full max-w-xs" />

          {/* The DESIGN.md spec: oversized Fraunces "Touché." headline */}
          <h1 className="font-display text-brass text-8xl leading-none tracking-tight md:text-[9rem]">
            Touché.
          </h1>

          <p className="text-mute max-w-sm text-lg leading-relaxed">
            That page doesn't exist — looks like you stepped out of bounds.
          </p>

          <Button as="link" href="/" variant="secondary">
            Back to home
          </Button>
        </div>
      </Container>
    </div>
  );
}

import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { ObservationForm } from "@/components/ObservationForm";

export const metadata: Metadata = {
  title: "Observe a Class | Des Moines Fencing Club",
  description:
    "Reserve a visit to come watch a class at the Des Moines Fencing Club. Choose the weapons and dates that work for you.",
};

export default function ObservePage() {
  return (
    <Section>
      <div className="grid grid-cols-12 gap-6 mb-12">
        <div className="col-span-12 md:col-span-5">
          <Eyebrow>Come see us</Eyebrow>
          <h1 className="text-5xl md:text-6xl mt-3 leading-[1.05]">
            Observe a class.
          </h1>
        </div>
        <div className="col-span-12 md:col-span-7">
          <p className="text-ink/75 text-lg leading-relaxed">
            Pick a class or two below and a coach will be ready to talk with
            you about getting started.
          </p>
          <p className="text-ink/70 mt-4 leading-relaxed">
            Visits are free, and there&apos;s no commitment. Families and
            beginners welcome.
          </p>
        </div>
      </div>

      <StripRule className="mb-12" />

      <div className="max-w-4xl">
        <ObservationForm />
      </div>
    </Section>
  );
}

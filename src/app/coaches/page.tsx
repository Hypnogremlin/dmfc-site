import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { DarkSection } from "@/components/DarkSection";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { CoachPortrait } from "@/components/CoachPortrait";
import { type Coach, coaches } from "@/lib/coaches";

export const metadata: Metadata = {
  title: "Coaches",
  description:
    "Meet the USFCA-certified coaches of the Des Moines Fencing Club, teaching foil, épée, and saber in central Iowa.",
};

export default function CoachesPage() {
  return (
    <>
      <Section>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-5">
            <Eyebrow>Coaching Staff</Eyebrow>
            <h1 className="mt-6 text-[clamp(48px,7vw,96px)] leading-[1.0]">
              <span className="italic">USFCA</span>‑certified.
              <br />
              Every weapon.
            </h1>
          </div>
          <div className="col-span-12 md:col-span-6 md:col-start-7 self-end">
            <p className="text-lg leading-relaxed text-ink">
              Our typical 60-minute classes are led by USFCA-certified coaches and built around warm-ups,
              footwork, blade work, games, and bouting. Between them, our staff covers all three Olympic
              weapons — foil, épée, and saber — from a fencer&rsquo;s first lunge through national-level
              competition.
            </p>
            <p className="mt-5 text-mute leading-relaxed">
              {/* TODO: individual coach bios — credentials, weapon background, years coaching — from owner. */}
            </p>
          </div>
        </div>
        <StripRule className="mt-20" />
      </Section>

      <DarkSection>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-3">
            <Eyebrow>The roster</Eyebrow>
          </div>
          <div className="col-span-12 md:col-span-9">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14 items-end">
              {coaches.map((coach) => (
                <CoachPortrait
                  key={coach.name}
                  name={coach.name}
                  role={coach.role}
                  image={coach.image}
                  bio={coach.bio}
                />
              ))}
            </div>
          </div>
        </div>
      </DarkSection>
    </>
  );
}

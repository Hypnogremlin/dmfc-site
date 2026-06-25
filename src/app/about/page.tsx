import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { DarkSection } from "@/components/DarkSection";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { StatBlock } from "@/components/StatBlock";
import { FeatureImage } from "@/components/FeatureImage";

export const metadata: Metadata = {
  title: "About",
  description:
    "Founded in 1997, the Des Moines Fencing Club is an Iowa 501(c)(3) non-profit teaching foil, épée, and saber to central Iowa.",
};

const board = [
  { name: "Pat Kennedy",       role: "President" },
  { name: "Jonathan Freed",    role: "Vice President" },
  { name: "Jem Gong-Brown",    role: "Treasurer" },
  { name: "Allison Orgeron",   role: "Secretary" },
  { name: "Mercedes Janecek",  role: "At-Large" },
  { name: "Joe Larson",        role: "Tournament Specialist" },
  { name: "Jeremy Orgeron",    role: "At-Large" },
  { name: "Kyle Happ",         role: "At-Large" },
];

export default function AboutPage() {
  const yearsActive = new Date().getFullYear() - 1997;

  return (
    <>
      <Section>
        <div className="grid grid-cols-12 gap-6 items-center">
          <div className="col-span-12 md:col-span-6">
            <Eyebrow>About the Club</Eyebrow>
            <h1 className="mt-6 text-[clamp(48px,7vw,96px)] leading-[1.0]">
              Six fencers.
              <br />
              <span className="italic">A foundation.</span>
            </h1>
            <p className="mt-8 text-lg leading-relaxed text-ink">
              Founded in June of 1997 by six people with various levels of fencing knowledge, the Des Moines Fencing Club was soon joined by other experienced fencers and many enthusiastic students. In 1999, the DMFC achieved Iowa non-profit organization status.
            </p>
            <p className="mt-5 text-lg leading-relaxed text-mute">
              The public is always welcome to come and observe and participate in DMFC practices.
            </p>
          </div>
          <div className="col-span-12 md:col-span-5 md:col-start-8 mt-10 md:mt-0">
            <FeatureImage
              src="/img/about.jpg"
              alt="Foils resting tip-up in their cases before practice"
              priority
              aspect="aspect-[3/2]"
            />
          </div>
        </div>
        <StripRule className="mt-20" />
      </Section>

      <Section>
        <div className="grid grid-cols-12 gap-y-12 gap-x-6">
          <div className="col-span-6 md:col-span-3">
            <StatBlock value="1997" label="Founded" />
          </div>
          <div className="col-span-6 md:col-span-3">
            <StatBlock value={`${yearsActive}`} label="Years active" />
          </div>
          <div className="col-span-6 md:col-span-3">
            <StatBlock value="501(c)(3)" label="Non-profit since 1999" />
          </div>
          <div className="col-span-6 md:col-span-3">
            <StatBlock value="3" label="Weapons taught" />
          </div>
        </div>
      </Section>

      <DarkSection>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-4">
            <Eyebrow>Philosophy</Eyebrow>
            <h2 className="mt-4 text-bone text-[clamp(36px,4.5vw,60px)]">
              We learn from each other, and teach each other whatever we can.
            </h2>
          </div>
          <div className="col-span-12 md:col-span-7 md:col-start-6 self-center">
            <p className="text-bone/85 text-lg leading-relaxed">
              Members of the DMFC compete in local and out-of-state tournaments and perform demonstrations across the Des Moines metro for schools, community groups, and other organizations curious about the sport.
            </p>
            <p className="mt-5 text-bone/70 text-lg leading-relaxed">
              These outreach efforts are run entirely by volunteers who donate their time — sometimes their vacation days — to spread the word about fencing. Our typical 60-minute classes are led by USFCA-certified coaches and built around warm-ups, footwork, blade work, and bouting.
            </p>
          </div>
        </div>
        <StripRule className="mt-16" />
        <div className="mt-12 grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-4 text-bone/60 text-sm uppercase tracking-[0.18em]">
            Legal standing
          </div>
          <ul className="col-span-12 md:col-span-7 md:col-start-6 space-y-2 text-bone/85 text-base leading-relaxed">
            <li>Iowa 504(a) non-profit organization</li>
            <li>Federal 501(c)(3) non-profit corporation</li>
            <li>Member club of the United States Fencing Association (USFA)</li>
          </ul>
        </div>
      </DarkSection>

      <Section>
        <div className="grid grid-cols-12 gap-6 mb-14">
          <div className="col-span-12 md:col-span-5">
            <Eyebrow>Board of Directors</Eyebrow>
            <h2 className="mt-4 text-[clamp(36px,4vw,56px)]">
              The volunteers behind the strip.
            </h2>
          </div>
          <div className="col-span-12 md:col-span-6 md:col-start-7 self-end">
            <p className="text-mute leading-relaxed">
              DMFC is governed by a volunteer board drawn from members and parents. They handle non-profit
              filings, scheduling, equipment, and the four annual tournaments the club hosts.
            </p>
          </div>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-2">
          {board.map(({ name, role }) => (
            <li
              key={name}
              className="border-t border-brass/30 pt-4 pb-2"
            >
              <span className="block font-display text-2xl md:text-[28px] leading-tight">{name}</span>
              <span className="block mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-mute">{role}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

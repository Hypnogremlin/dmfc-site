import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { DarkSection } from "@/components/DarkSection";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { CoachPortrait } from "@/components/CoachPortrait";

export const metadata: Metadata = {
  title: "Coaches",
  description:
    "Meet the USFCA-certified coaches of the Des Moines Fencing Club, teaching foil, épée, and saber in central Iowa.",
};

type Coach = {
  name: string;
  role: string;
  image?: string;
  bio?: string;
};

// Ordered as they appear on the archived about_coaches.html page.
const coaches: Coach[] = [
  { name: "Jon Greising", role: "Foil & Épée", image: "/coaches/jon.jpg" },
  { name: "Preston Kirkpatrick", role: "Saber", image: "/coaches/preston.jpg" },
  { name: "Josiah Janecek", role: "Foil", image: "/coaches/josiah.jpg" },
  { name: "Emilia Reis", role: "Saber", image: "/coaches/emilia.jpg" },
  { name: "Abbey Freed", role: "Foil", image: "/coaches/abbey.jpg" },
  { name: "Taryn Young", role: "Foil" },
  { name: "Trevor Carra", role: "Saber" },
  { name: "Levi Miller", role: "Saber" },
];

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

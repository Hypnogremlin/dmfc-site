import { DarkSection } from "@/components/DarkSection";
import { Section } from "@/components/Section";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { NextTournamentCard } from "@/components/NextTournamentCard";
import { NewsTeaser } from "@/components/NewsTeaser";
import { getUpcomingTournaments, getRecentNews } from "@/lib/news";

export default function Home() {
  // Conditional content surfaced from the unified /news collection.
  // Both sections silently omit themselves when empty — no placeholder UI.
  const nextTournament = getUpcomingTournaments()[0];
  const recentAnnouncements = getRecentNews(90)
    .filter((e) => e.type !== "tournament")
    .slice(0, 3);

  return (
    <>
      {/* Hero — full-bleed dark section, oversized Fraunces, brass rule */}
      <DarkSection className="relative overflow-hidden">
        <div className="grid grid-cols-12 gap-6 items-center min-h-[60vh]">
          <div className="col-span-12 lg:col-span-8">
            <Eyebrow className="text-brass">Est. 1997 · Des Moines, Iowa</Eyebrow>
            <h1 className="mt-6 text-bone text-[clamp(56px,8vw,120px)] leading-[0.95]">
              The art of
              <br />
              fencing,
              <br />
              <span className="italic">in central Iowa.</span>
            </h1>
            <div className="mt-10 flex flex-wrap items-center gap-6">
              <Button as="link" href="/observe" variant="primary">
                Observe a Class
              </Button>
              <a
                href="/classes"
                className="underline-draw text-bone text-sm font-medium tracking-wide uppercase"
              >
                Or learn the weapons
              </a>
            </div>
          </div>
        </div>
        <StripRule className="mt-16" />
      </DarkSection>

      {/* Mission — paper section with eyebrow + editorial H2 */}
      <Section>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-4">
            <Eyebrow>Our mission</Eyebrow>
          </div>
          <div className="col-span-12 md:col-span-8">
            <h2 className="text-[clamp(36px,4vw,56px)]">
              Teach and promote the three disciplines of Olympic fencing — foil, épée, and saber — for fencers of every age.
            </h2>
            <p className="mt-6 text-mute text-lg max-w-2xl">
              From first-time visitors to national-level competitors, the Des Moines Fencing Club cultivates a community that challenges every athlete to pursue their best.
            </p>
          </div>
        </div>
      </Section>

      {/* What we teach — three weapon cards (placeholder treatment until WeaponCard exists) */}
      <Section className="bg-bone">
        <div className="grid grid-cols-12 gap-6 mb-12">
          <div className="col-span-12 md:col-span-4">
            <Eyebrow>What we teach</Eyebrow>
            <h2 className="mt-4 text-4xl">Three weapons, one discipline.</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { name: "Foil", body: "A light thrusting weapon. Torso only. Right-of-way decides the point." },
            { name: "Épée", body: "Heavier and unrestricted — the entire body is target. No right of way. The duelist's weapon." },
            { name: "Saber", body: "A cutting and thrusting weapon. Everything above the waist. No time limit. Fast and aggressive." },
          ].map((w) => (
            <Card key={w.name}>
              <Eyebrow>Weapon</Eyebrow>
              <h3 className="mt-3 text-3xl">{w.name}</h3>
              <p className="mt-4 text-mute leading-relaxed">{w.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Schedule snapshot — tabular treatment */}
      <Section>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-4">
            <Eyebrow>When we meet</Eyebrow>
            <h2 className="mt-4 text-4xl">Weekly schedule.</h2>
            <p className="mt-4 text-mute">
              West Des Moines Christian Church
              <br />
              4501 Mills Civic Parkway
            </p>
          </div>
          <div className="col-span-12 md:col-span-8">
            <div className="border-t border-rule">
              {[
                ["Monday", "Foil", "6:30p · Youth class & bouting"],
                ["Monday", "Foil", "8:00p · Adult class & bouting"],
                ["Monday", "Épée", "8:00p · Adult épée"],
                ["Thursday", "Saber", "6:00p · Class & bouting"],
              ].map(([day, weapon, detail], i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 gap-4 py-4 border-b border-rule items-baseline"
                >
                  <div className="col-span-3 tabular text-sm uppercase tracking-wider text-mute">
                    {day}
                  </div>
                  <div className="col-span-3 font-display text-xl">{weapon}</div>
                  <div className="col-span-6 tabular text-sm text-ink">{detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Next tournament — loud feature card; only renders if one is upcoming */}
      {nextTournament && (
        <Section className="bg-bone">
          <div className="grid grid-cols-12 gap-6 mb-10">
            <div className="col-span-12 md:col-span-4">
              <Eyebrow>On the calendar</Eyebrow>
              <h2 className="mt-4 text-4xl">Coming up.</h2>
            </div>
          </div>
          <NextTournamentCard entry={nextTournament} />
        </Section>
      )}

      {/* Latest news — quieter three-up; only renders if recent non-tournament entries exist */}
      {recentAnnouncements.length > 0 && (
        <Section>
          <div className="grid grid-cols-12 gap-6 mb-10">
            <div className="col-span-12 md:col-span-4">
              <Eyebrow>From the club</Eyebrow>
              <h2 className="mt-4 text-4xl">Latest news.</h2>
            </div>
            <div className="col-span-12 md:col-span-8 md:flex md:items-end md:justify-end">
              <a
                href="/news"
                className="underline-draw text-sm font-semibold uppercase tracking-[0.08em] text-purple-700"
              >
                All news →
              </a>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
            {recentAnnouncements.map((entry) => (
              <NewsTeaser key={entry.slug} entry={entry} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

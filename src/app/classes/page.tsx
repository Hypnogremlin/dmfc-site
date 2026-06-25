import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { DarkSection } from "@/components/DarkSection";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { ScheduleTable, type ScheduleRow } from "@/components/ScheduleTable";
import { WeaponCard } from "@/components/WeaponCard";
import { FeatureImage } from "@/components/FeatureImage";

export const metadata: Metadata = {
  title: "Classes",
  description:
    "Weekly fencing classes in foil, épée, and saber at the Des Moines Fencing Club — taught by USFCA-certified coaches.",
};

const foilSchedule: ScheduleRow[] = [
  { segment: "Youth Class", ageGroup: "Youth (ages 8–11)", day: "Monday", time: "6:30 – 7:30p" },
  { segment: "Adult Class", ageGroup: "Adult (ages 12 & up)", day: "Monday", time: "8:00 – 9:00p" },
];

const epeeSchedule: ScheduleRow[] = [
  { segment: "Adult Class", ageGroup: "Adult", day: "Monday", time: "6:30 – 7:30p" },
];

const saberSchedule: ScheduleRow[] = [
  { segment: "Class", ageGroup: "All ages", day: "Thursday", time: "6:30 – 7:30p" },
];

const openBoutingSchedule: ScheduleRow[] = [
  { segment: "3 Weapon Bouting", ageGroup: "All ages", day: "Monday", time: "9:00 – 10:00p" },
  { segment: "3 Weapon Bouting", ageGroup: "All ages", day: "Thursday", time: "8:00 – 9:00p" },
];

export default function ClassesPage() {
  return (
    <>
      <Section>
        <div className="grid grid-cols-12 gap-6 items-center">
          <div className="col-span-12 md:col-span-7">
            <Eyebrow>Weekly Classes</Eyebrow>
            <h1 className="mt-6 text-[clamp(48px,7vw,96px)] leading-[1.0]">
              Two nights.
              <br />
              <span className="italic">Three weapons.</span>
            </h1>
            <p className="mt-8 text-lg leading-relaxed text-ink">
              Mondays cover foil and épée. Thursdays are saber. Each 60-minute class is led by a
              USFCA-certified coach and built around warm-ups, footwork, blade work, and bouting —
              with games and drills throughout to keep it fun.
            </p>
            <p className="mt-5 text-mute leading-relaxed">
              All classes meet at West Des Moines Christian Church. New to the sport?{" "}
              <a href="/observe" className="underline-draw text-ink hover:text-purple-700">
                Come watch a class first
              </a>
              .
            </p>
          </div>
          <div className="col-span-12 md:col-span-4 md:col-start-9 mt-10 md:mt-0">
            <FeatureImage
              src="/img/classes.jpg"
              alt="Fencers drilling footwork and blade work during a club class"
              priority
              aspect="aspect-[3/4]"
            />
          </div>
        </div>
        <StripRule className="mt-20" />
      </Section>

      <DarkSection>
        <div className="grid grid-cols-12 gap-6 mb-14">
          <div className="col-span-12 md:col-span-5">
            <Eyebrow>The Olympic weapons</Eyebrow>
            <h2 className="mt-4 text-bone text-[clamp(36px,4.5vw,60px)] leading-[1.05]">
              Three weapons,
              <br />
              three sports.
            </h2>
          </div>
          <div className="col-span-12 md:col-span-6 md:col-start-7 self-end">
            <p className="text-bone/85 text-lg leading-relaxed">
              Foil, épée, and saber share an ancestry but ask very different things of a fencer.
              Different target areas, different rules of priority, different blade actions. Most
              fencers find a favorite within their first few months.
            </p>
          </div>
        </div>

        <StripRule className="mb-14" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <WeaponCard
            name="Foil"
            tagline="Point control"
            target="Torso only — no arms or legs."
            style="Light thrusting weapon. Right-of-way decides priority."
            description={
              <>
                <p>
                  Touches score only with the tip. Off-target hits stop the action but don&rsquo;t
                  score. When both fencers land at once, the referee uses right-of-way to award the
                  touch.
                </p>
                <p className="mt-3 text-bone/60 text-sm">
                  Three 3-minute rounds. First to 15, or highest score at time.
                </p>
              </>
            }
          />
          <WeaponCard
            name="Épée"
            tagline="Whole-target"
            target="Entire body — mask to shoe."
            style="Heavier thrusting weapon. No right-of-way."
            description={
              <>
                <p>
                  The large bell guard covers the hand, which is itself a valid target. Both
                  fencers can score on a simultaneous touch — except at the last point of a tied
                  bout, where double touches are nullified.
                </p>
                <p className="mt-3 text-bone/60 text-sm">
                  Three 3-minute rounds. First to 15, or highest score at time.
                </p>
              </>
            }
          />
          <WeaponCard
            name="Saber"
            tagline="Cut and thrust"
            target="Above the waist, including the mask — excluding the hands."
            style="Light cutting weapon. Right-of-way; no clock cap."
            description={
              <>
                <p>
                  The whole blade and the point score. The D-guard wraps from hilt to pommel and is
                  turned outward to parry. Saber actions are fast enough that bouts run without a
                  time limit.
                </p>
                <p className="mt-3 text-bone/60 text-sm">
                  One-minute break at 8 points. First to 15 wins.
                </p>
              </>
            }
          />
        </div>
      </DarkSection>

      <Section>
        <div className="grid grid-cols-12 gap-6 mb-14">
          <div className="col-span-12 md:col-span-4">
            <Eyebrow>The schedule</Eyebrow>
            <h2 className="mt-4 text-[clamp(32px,3.5vw,48px)] leading-tight">
              By weapon.
            </h2>
          </div>
          <div className="col-span-12 md:col-span-7 md:col-start-6 self-end">
            <p className="text-mute leading-relaxed">
              Each weapon&rsquo;s classes are listed below by segment and age group. Foil and épée
              share Monday evenings; saber has its own block on Thursdays.
            </p>
          </div>
        </div>

        <div className="space-y-16">
          <div>
            <h3 className="font-display text-3xl md:text-4xl leading-tight mb-4">Foil</h3>
            <ScheduleTable rows={foilSchedule} />
          </div>
          <div>
            <h3 className="font-display text-3xl md:text-4xl leading-tight mb-4">Épée</h3>
            <ScheduleTable rows={epeeSchedule} />
          </div>
          <div>
            <h3 className="font-display text-3xl md:text-4xl leading-tight mb-4">Saber</h3>
            <ScheduleTable rows={saberSchedule} />
          </div>
          <div>
            <h3 className="font-display text-3xl md:text-4xl leading-tight">Open Bouting</h3>
            <p className="mt-1 mb-4 text-mute text-[15px]">
              Drop-in fencing for all weapons — not held during class times.
            </p>
            <ScheduleTable rows={openBoutingSchedule} />
          </div>
        </div>

        <p className="mt-12 max-w-2xl text-mute text-[15px] leading-relaxed">
          <strong className="font-semibold text-ink">Weather:</strong> we follow the West Des
          Moines community school district&rsquo;s closings for inclement weather. Cancellations
          are announced by email and on our Facebook page.
        </p>
      </Section>

      <Section>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-4">
            <Eyebrow>How a class typically runs</Eyebrow>
            <h2 className="mt-4 text-[clamp(32px,3.5vw,48px)] leading-tight">
              Sixty minutes,
              <br />
              <span className="italic">end to end.</span>
            </h2>
          </div>
          <div className="col-span-12 md:col-span-7 md:col-start-6 self-end">
            <ol className="space-y-5 text-ink leading-relaxed">
              <li className="grid grid-cols-[auto_1fr] gap-x-6 border-t border-brass/30 pt-4">
                <span className="font-display text-2xl text-brass leading-none pt-0.5">01</span>
                <div>
                  <h3 className="font-display text-xl leading-tight">Warm-ups &amp; stretches</h3>
                  <p className="mt-1 text-mute text-[15px]">
                    Light cardio and dynamic stretching to prep for explosive footwork.
                  </p>
                </div>
              </li>
              <li className="grid grid-cols-[auto_1fr] gap-x-6 border-t border-brass/30 pt-4">
                <span className="font-display text-2xl text-brass leading-none pt-0.5">02</span>
                <div>
                  <h3 className="font-display text-xl leading-tight">Footwork</h3>
                  <p className="mt-1 text-mute text-[15px]">
                    Advances, retreats, lunges. The foundation everything else is built on.
                  </p>
                </div>
              </li>
              <li className="grid grid-cols-[auto_1fr] gap-x-6 border-t border-brass/30 pt-4">
                <span className="font-display text-2xl text-brass leading-none pt-0.5">03</span>
                <div>
                  <h3 className="font-display text-xl leading-tight">Blade work</h3>
                  <p className="mt-1 text-mute text-[15px]">
                    Drills with a partner — attacks, parries, ripostes — tuned to the night&rsquo;s
                    weapon.
                  </p>
                </div>
              </li>
              <li className="grid grid-cols-[auto_1fr] gap-x-6 border-t border-brass/30 pt-4">
                <span className="font-display text-2xl text-brass leading-none pt-0.5">04</span>
                <div>
                  <h3 className="font-display text-xl leading-tight">Games &amp; bouting</h3>
                  <p className="mt-1 text-mute text-[15px]">
                    Structured games or coached bouting where the night allows. Where the lessons
                    stick.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </Section>
    </>
  );
}

import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";

export const metadata: Metadata = {
  title: "Members",
  description:
    "Expectations for DMFC athletes and parents, weather policy, and a link to the official USA Fencing rulebook.",
};

const athleteExpectations = [
  "Fence for fun.",
  "Work hard to improve your skills.",
  "Learn sportsmanship, discipline, and teamwork.",
  "Know the rules and play by them. Always be a good sport.",
  "Respect yourself, your coach, your fellow athletes, parents, opponents, and officials.",
  "Maintain an active USFA membership. Lapsed membership suspends club membership.",
  "Follow USFA safety rules. Violations are reviewed by the Board and may result in discipline up to termination.",
];

const parentExpectations = [
  "Support your child’s desire to fence. Make it fun.",
  "Encourage them to play by the rules. Be a positive role model.",
  "Don’t embarrass your child by yelling at players, coaches, or officials.",
  "Emphasize skill development and practice. De-emphasize competition in lower age groups.",
  "Know and study the rules. Support the officials.",
  "Applaud good effort in both victory and defeat.",
  "Never yell at or physically abuse your child at competition or practice.",
  "Help USA Fencing remove physical and verbal abuse from the sport.",
];

export default function MembersPage() {
  return (
    <>
      <Section>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-5">
            <Eyebrow>For Members</Eyebrow>
            <h1 className="mt-6 text-[clamp(48px,7vw,96px)] leading-[1.0]">
              Conduct
              <br />
              <span className="italic">on and off the strip.</span>
            </h1>
          </div>
          <div className="col-span-12 md:col-span-6 md:col-start-7 self-end">
            <p className="text-lg leading-relaxed text-ink">
              The expectations below apply to every fencer in the club and to the parents who
              support them. They&rsquo;re drawn from USA Fencing&rsquo;s safety and sportsmanship
              guidance and from the values the club was founded on.
            </p>
            <p className="mt-5 text-mute leading-relaxed">
              The full set of competition rules is maintained by USA Fencing and{" "}
              <a
                href="https://www.usafencing.org/rules-compliance#USA_Fencing_Rulebook_csec"
                target="_blank"
                rel="noreferrer"
                className="underline-draw text-ink hover:text-purple-700"
              >
                published in their rulebook
              </a>
              .
            </p>
          </div>
        </div>
        <StripRule className="mt-20" />
      </Section>

      <Section className="!pt-0">
        <div className="grid grid-cols-12 gap-y-16 gap-x-6">
          <div className="col-span-12 md:col-span-5">
            <Eyebrow>Athletes</Eyebrow>
            <h2 className="mt-4 text-[clamp(32px,3.5vw,48px)] leading-tight">
              What we ask
              <br />
              of every fencer.
            </h2>
            <p className="mt-6 text-mute leading-relaxed max-w-md">
              These aren&rsquo;t suggestions. They&rsquo;re the floor we agree to as a club so the
              training environment stays serious, safe, and welcoming.
            </p>
          </div>
          <div className="col-span-12 md:col-span-6 md:col-start-7">
            <ul className="space-y-5">
              {athleteExpectations.map((line, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[auto_1fr] gap-x-6 border-t border-brass/30 pt-4"
                >
                  <span className="font-display text-brass text-xl leading-none pt-1 tabular">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-ink leading-relaxed text-[17px]">
                    {line}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-12">
            <StripRule />
          </div>

          <div className="col-span-12 md:col-span-5">
            <Eyebrow>Parents</Eyebrow>
            <h2 className="mt-4 text-[clamp(32px,3.5vw,48px)] leading-tight">
              For the
              <br />
              parents in the room.
            </h2>
            <p className="mt-6 text-mute leading-relaxed max-w-md">
              Fencing is a slow-build sport. The parents who help most are the ones who applaud the
              effort and let the coaches coach.
            </p>
          </div>
          <div className="col-span-12 md:col-span-6 md:col-start-7">
            <ul className="space-y-5">
              {parentExpectations.map((line, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[auto_1fr] gap-x-6 border-t border-brass/30 pt-4"
                >
                  <span className="font-display text-brass text-xl leading-none pt-1 tabular">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-ink leading-relaxed text-[17px]">
                    {line}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section className="!pt-0">
        <StripRule className="mb-16" />
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-5">
            <Eyebrow>Weather policy</Eyebrow>
            <h2 className="mt-4 text-[clamp(28px,3vw,40px)] leading-tight">
              When school&rsquo;s closed,
              <br />
              <span className="italic">we&rsquo;re closed.</span>
            </h2>
          </div>
          <div className="col-span-12 md:col-span-6 md:col-start-7 self-end">
            <p className="text-ink leading-relaxed">
              The club follows the West Des Moines community school district&rsquo;s closings for
              inclement weather. If schools cancel evening activities, classes are cancelled too.
            </p>
            <p className="mt-5 text-mute leading-relaxed">
              Weather cancellations and schedule changes are sent by email to active members and
              posted to the club&rsquo;s Facebook page and groups.
            </p>
          </div>
        </div>
      </Section>

      <Section className="!pt-0">
        <StripRule className="mb-16" />
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-5">
            <Eyebrow>The Rulebook</Eyebrow>
            <h2 className="mt-4 text-[clamp(28px,3vw,40px)] leading-tight">
              The official rules
              <br />
              of the sport.
            </h2>
          </div>
          <div className="col-span-12 md:col-span-6 md:col-start-7 self-end">
            <p className="text-ink leading-relaxed">
              Competition rules, equipment standards, and refereeing conventions are maintained by
              USA Fencing in a single rulebook updated each season. Members are expected to be
              familiar with it.
            </p>
            <p className="mt-6">
              <a
                href="https://www.usafencing.org/rules-compliance#USA_Fencing_Rulebook_csec"
                target="_blank"
                rel="noreferrer"
                className="underline-draw font-display text-2xl text-ink hover:text-purple-700"
              >
                Read the USA Fencing Rulebook
              </a>
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}

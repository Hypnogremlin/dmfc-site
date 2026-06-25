import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { DarkSection } from "@/components/DarkSection";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { Card } from "@/components/Card";
import { FeatureImage } from "@/components/FeatureImage";

export const metadata: Metadata = {
  title: "Fees",
  description:
    "Membership tiers, equipment requirements, and USA Fencing membership info for the Des Moines Fencing Club.",
};

type Tier = {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  includes: string[];
  emphasis?: boolean;
};

const tiers: Tier[] = [
  {
    name: "Club Base Membership",
    price: "$50",
    cadence: "per month",
    blurb: "Access to bouting times and the social life of the club.",
    includes: [
      "Open bouting time on practice nights",
      "Club social events",
      "Extra programming throughout the year",
    ],
  },
  {
    name: "Base + Group Class",
    price: "$70",
    cadence: "per month",
    blurb: "The full member experience — base membership plus coached weapon classes.",
    includes: [
      "Everything in Base Membership",
      "60-minute weapon classes with USFA-certified coaches",
      "Eligible for individual coach lessons (priced by coach)",
    ],
    emphasis: true,
  },
  {
    name: "Non-member Drop-in",
    price: "$20",
    cadence: "per class",
    blurb: "For visiting fencers from other clubs passing through West Des Moines.",
    includes: [
      "Single class attendance",
      "No ongoing commitment",
    ],
  },
];

const startingGear = [
  "Athletic shoes (volleyball / tennis court or fencing shoes)",
  "Knee-high socks",
  "Athletic t-shirt",
  "Athletic shorts",
  "Water bottle",
  "Gym or fencer's bag",
];

const whites = [
  "Mask",
  "Weapon",
  "Jacket",
  "Plastron",
  "Chest protector (as required or requested)",
  "Glove",
  "Knickers",
];

const competitive = [
  "Lamé",
  "Two body cords",
  "Two mask cords",
];

export default function FeesPage() {
  return (
    <>
      <Section>
        <div className="grid grid-cols-12 gap-6 items-center">
          <div className="col-span-12 md:col-span-7">
            <Eyebrow>Membership &amp; fees</Eyebrow>
            <h1 className="mt-6 text-[clamp(48px,7vw,96px)] leading-[1.0]">
              What it
              <br />
              <span className="italic">costs to fence.</span>
            </h1>
            <p className="mt-8 text-lg leading-relaxed text-ink">
              Monthly dues cover coaching and club operations. Equipment is purchased separately —
              the club helps with sizing, and you can build a kit gradually as you commit to the
              sport.
            </p>
            <p className="mt-5 text-mute leading-relaxed">
              Not sure yet?{" "}
              <a href="/observe" className="underline-draw text-ink hover:text-purple-700">
                Watch a class first
              </a>{" "}
              — there&rsquo;s no charge to observe.
            </p>
          </div>
          <div className="col-span-12 md:col-span-4 md:col-start-9 mt-10 md:mt-0">
            <FeatureImage
              src="/img/fees.jpg"
              alt="Two fencers in their whites after a bout"
              priority
              aspect="aspect-[2/3]"
            />
          </div>
        </div>
        <StripRule className="mt-20" />
      </Section>

      <Section className="!pt-0">
        <div className="grid grid-cols-12 gap-6 mb-12">
          <div className="col-span-12 md:col-span-4">
            <Eyebrow>The tiers</Eyebrow>
            <h2 className="mt-4 text-[clamp(32px,3.5vw,48px)] leading-tight">
              Three ways in.
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={tier.emphasis ? "bg-purple-50/60 border-brass/50" : ""}
            >
              <Eyebrow>{tier.emphasis ? "Most common" : "Tier"}</Eyebrow>
              <h3 className="mt-3 font-display text-2xl md:text-3xl leading-tight">
                {tier.name}
              </h3>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-brass text-[clamp(48px,6vw,72px)] leading-none tracking-tight">
                  {tier.price}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mute">
                  {tier.cadence}
                </span>
              </div>
              <p className="mt-6 text-ink leading-relaxed text-[15px]">{tier.blurb}</p>
              <div className="my-6 h-px w-full bg-brass/25" aria-hidden="true" />
              <ul className="space-y-2.5 text-[15px] text-ink leading-snug">
                {tier.includes.map((line) => (
                  <li key={line} className="grid grid-cols-[auto_1fr] gap-3">
                    <span aria-hidden="true" className="text-brass mt-0.5">
                      —
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <p className="mt-8 text-sm text-mute leading-relaxed max-w-2xl">
          Individual coach lessons are billed by the coach at a rate they set. Talk to your coach
          directly to arrange one-on-one work.
        </p>
      </Section>

      <DarkSection>
        <div className="grid grid-cols-12 gap-6 mb-14">
          <div className="col-span-12 md:col-span-5">
            <Eyebrow>Equipment</Eyebrow>
            <h2 className="mt-4 text-bone text-[clamp(36px,4.5vw,60px)] leading-[1.05]">
              You can start
              <br />
              with what you have.
            </h2>
          </div>
          <div className="col-span-12 md:col-span-6 md:col-start-7 self-end">
            <p className="text-bone/85 text-lg leading-relaxed">
              New fencers can begin with athletic gear they likely already own — the club lends
              weapons, masks, and jackets while you decide whether to invest in your own kit.
              Coaches help with sizing before you buy.
            </p>
          </div>
        </div>

        <StripRule className="mb-14" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <div className="flex items-baseline justify-between">
              <Eyebrow>To start</Eyebrow>
              <span className="font-display text-brass text-2xl leading-none">$0+</span>
            </div>
            <h3 className="mt-3 font-display text-bone text-2xl leading-tight">
              Athletic basics
            </h3>
            <p className="mt-3 text-bone/65 text-sm">Wear what you have. The club covers the rest at first.</p>
            <ul className="mt-6 space-y-2 text-bone/85 text-[15px] leading-snug">
              {startingGear.map((item) => (
                <li key={item} className="grid grid-cols-[auto_1fr] gap-3">
                  <span aria-hidden="true" className="text-brass">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <Eyebrow>Personal kit</Eyebrow>
              <span className="font-display text-brass text-2xl leading-none">$130&ndash;200+</span>
            </div>
            <h3 className="mt-3 font-display text-bone text-2xl leading-tight">
              Fencer&rsquo;s whites
            </h3>
            <p className="mt-3 text-bone/65 text-sm">
              Once you&rsquo;re committed, your own uniform. Sized with your coach.
            </p>
            <ul className="mt-6 space-y-2 text-bone/85 text-[15px] leading-snug">
              {whites.map((item) => (
                <li key={item} className="grid grid-cols-[auto_1fr] gap-3">
                  <span aria-hidden="true" className="text-brass">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <Eyebrow>For tournaments</Eyebrow>
              <span className="font-display text-brass text-2xl leading-none">$140+</span>
            </div>
            <h3 className="mt-3 font-display text-bone text-2xl leading-tight">
              Competitive kit
            </h3>
            <p className="mt-3 text-bone/65 text-sm">
              Required only for sanctioned competition. Recreational fencers can skip it.
            </p>
            <ul className="mt-6 space-y-2 text-bone/85 text-[15px] leading-snug">
              {competitive.map((item) => (
                <li key={item} className="grid grid-cols-[auto_1fr] gap-3">
                  <span aria-hidden="true" className="text-brass">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DarkSection>

      <Section>
        <div className="grid grid-cols-12 gap-6 mb-12">
          <div className="col-span-12 md:col-span-5">
            <Eyebrow>USA Fencing</Eyebrow>
            <h2 className="mt-4 text-[clamp(32px,3.5vw,48px)] leading-tight">
              National membership.
            </h2>
          </div>
          <div className="col-span-12 md:col-span-6 md:col-start-7 self-end">
            <p className="text-ink leading-relaxed">
              All DMFC members carry an active USA Fencing membership. The club{" "}
              <strong className="font-semibold">covers your first year</strong> of
              non-competitive membership; after that, members are required to maintain their own.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <Eyebrow>Recreational</Eyebrow>
            <h3 className="mt-3 font-display text-2xl md:text-3xl leading-tight">
              Non-Competitive
            </h3>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-display text-brass text-[clamp(48px,6vw,72px)] leading-none tracking-tight">
                $10
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mute">
                per year
              </span>
            </div>
            <p className="mt-6 text-ink leading-relaxed text-[15px]">
              For fencers who train but don&rsquo;t enter sanctioned events.
            </p>
            <div className="my-6 h-px w-full bg-brass/25" aria-hidden="true" />
            <ul className="space-y-2.5 text-[15px] text-ink leading-snug">
              <li className="grid grid-cols-[auto_1fr] gap-3">
                <span aria-hidden="true" className="text-brass mt-0.5">—</span>
                <span>Secondary medical / accident insurance</span>
              </li>
              <li className="grid grid-cols-[auto_1fr] gap-3">
                <span aria-hidden="true" className="text-brass mt-0.5">—</span>
                <span>Cannot compete in sanctioned events</span>
              </li>
              <li className="grid grid-cols-[auto_1fr] gap-3">
                <span aria-hidden="true" className="text-brass mt-0.5">—</span>
                <span>No voting privileges</span>
              </li>
            </ul>
          </Card>

          <Card className="bg-purple-50/60 border-brass/50">
            <Eyebrow>For tournaments</Eyebrow>
            <h3 className="mt-3 font-display text-2xl md:text-3xl leading-tight">
              Competitive
            </h3>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-display text-brass text-[clamp(48px,6vw,72px)] leading-none tracking-tight">
                $75
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mute">
                per year
              </span>
            </div>
            <p className="mt-6 text-ink leading-relaxed text-[15px]">
              Required to compete at local, divisional, regional, and national events.
            </p>
            <div className="my-6 h-px w-full bg-brass/25" aria-hidden="true" />
            <ul className="space-y-2.5 text-[15px] text-ink leading-snug">
              <li className="grid grid-cols-[auto_1fr] gap-3">
                <span aria-hidden="true" className="text-brass mt-0.5">—</span>
                <span>All sanctioned competition access</span>
              </li>
              <li className="grid grid-cols-[auto_1fr] gap-3">
                <span aria-hidden="true" className="text-brass mt-0.5">—</span>
                <span>Secondary medical / accident insurance</span>
              </li>
              <li className="grid grid-cols-[auto_1fr] gap-3">
                <span aria-hidden="true" className="text-brass mt-0.5">—</span>
                <span>Voting privileges in USA Fencing</span>
              </li>
              <li className="grid grid-cols-[auto_1fr] gap-3">
                <span aria-hidden="true" className="text-brass mt-0.5">—</span>
                <span>Subscription to American Fencing Magazine</span>
              </li>
            </ul>
          </Card>
        </div>

        <p className="mt-10 text-sm text-mute leading-relaxed max-w-2xl">
          Sign up or renew directly with USA Fencing at{" "}
          <a
            href="https://www.usafencing.org/membership"
            target="_blank"
            rel="noreferrer"
            className="underline-draw text-ink hover:text-purple-700"
          >
            usafencing.org/membership
          </a>
          .
        </p>
      </Section>
    </>
  );
}

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
  eyebrow?: string;
  price: string;
  cadence: string;
  blurb: string;
  includes: string[];
  emphasis?: boolean;
  asterisk?: boolean;
  note?: string;
};

const tiers: Tier[] = [
  {
    name: "Club Membership + Group Class",
    eyebrow: "Most common",
    price: "$70",
    cadence: "per month",
    blurb: "The standard way in — open bouting access, club life, and one coached weapon class each week.",
    includes: [
      "Open bouting time on practice nights",
      "One 60-minute weapon class with USFA-certified coaches",
      "Club social events and extra programming throughout the year",
      "Eligible for individual coach lessons (priced by coach)",
    ],
    emphasis: true,
    asterisk: true,
  },
  {
    name: "Additional Group Class",
    eyebrow: "Add-on",
    price: "+$20",
    cadence: "per class / month",
    blurb: "Already a member? Stack another weapon class onto your membership — each one adds $20/month.",
    includes: [
      "One additional 60-minute coached class per week",
      "Explore a second weapon or go deeper in one discipline",
      "Add as many classes as your schedule allows",
      "Available to all active club members",
    ],
    asterisk: true,
  },
  {
    name: "Non-member Drop-in",
    eyebrow: "Drop-in",
    price: "$20",
    cadence: "per class",
    blurb: "For visiting fencers from other clubs passing through West Des Moines.",
    includes: [
      "Single class attendance",
      "No ongoing commitment",
    ],
    note: "A waiver is required to participate. Waivers are available on arrival and must be renewed annually.",
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
              <Eyebrow>{tier.eyebrow ?? "Tier"}</Eyebrow>
              <h3 className="mt-3 font-display text-2xl md:text-3xl leading-tight">
                {tier.name}{tier.asterisk && <sup className="text-brass ml-0.5">*</sup>}
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
              {tier.note && (
                <p className="mt-5 text-[13px] text-mute leading-relaxed border-t border-brass/20 pt-4">
                  {tier.note}
                </p>
              )}
            </Card>
          ))}
        </div>

        <p className="mt-8 text-sm text-mute leading-relaxed max-w-2xl">
          Individual coach lessons are billed by the coach at a rate they set. Talk to your coach
          directly to arrange one-on-one work.
        </p>
        <p className="mt-3 text-sm text-mute leading-relaxed max-w-2xl">
          * An annual membership fee is also required, covering both your DMFC membership and USA
          Fencing membership.
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
              <span className="font-display text-brass text-2xl leading-none">$200&ndash;400</span>
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

    </>
  );
}

import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { MapEmbed } from "@/components/MapEmbed";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Mailing address, email, and where to find the Des Moines Fencing Club in West Des Moines, Iowa.",
};

const LAT = 41.560615;
const LON = -93.766484;
const BBOX = `${LON - 0.008},${LAT - 0.005},${LON + 0.008},${LAT + 0.005}`;
const MARKER = `${LAT},${LON}`;

export default function ContactPage() {
  return (
    <Section>
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-5">
          <Eyebrow>Get in touch</Eyebrow>
          <h1 className="mt-6 text-[clamp(48px,7vw,96px)] leading-[1.0]">
            Contact.
          </h1>
          <p className="mt-6 text-mute leading-relaxed max-w-md">
            Questions about classes, observing a practice, or hosting a demonstration? Reach out — a board
            member or coach will get back to you.
          </p>
        </div>

        <div className="col-span-12 md:col-span-6 md:col-start-7 self-end">
          <dl className="grid grid-cols-1 gap-y-8">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mute">
                By email
              </dt>
              <dd className="mt-2">
                <a
                  href="mailto:DMFCPresident@gmail.com"
                  className="underline-draw font-display text-2xl md:text-3xl text-ink hover:text-purple-700 transition-colors"
                >
                  DMFCPresident@gmail.com
                </a>
              </dd>
            </div>

            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mute">
                By mail
              </dt>
              <dd className="mt-2 font-display text-xl leading-snug text-ink">
                Des Moines Fencing Club
                <br />
                P.O. Box 66044
                <br />
                Des Moines, IA 50266
              </dd>
            </div>

            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mute">
                Find us online
              </dt>
              <dd className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <a
                  href="https://www.facebook.com/DesMoinesFencingClub/"
                  target="_blank"
                  rel="noreferrer"
                  className="underline-draw text-ink hover:text-purple-700 transition-colors"
                >
                  Facebook
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <StripRule className="my-20" />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4">
          <Eyebrow>Where we meet</Eyebrow>
          <h2 className="mt-4 text-[clamp(32px,3.5vw,48px)] leading-tight">
            West Des Moines Christian Church
          </h2>
          <p className="mt-4 text-ink leading-relaxed">
            4501 Mills Civic Parkway
            <br />
            West Des Moines, IA 50265
          </p>
          <p className="mt-6 text-sm text-mute leading-relaxed">
            Mondays — foil &amp; épée. Thursdays — saber. See the{" "}
            <a href="/classes" className="underline-draw text-ink hover:text-purple-700">
              full schedule
            </a>
            .
          </p>
        </div>
        <div className="col-span-12 md:col-span-8">
          <MapEmbed
            bbox={BBOX}
            marker={MARKER}
            title="Map showing West Des Moines Christian Church, 4501 Mills Civic Parkway"
          />
        </div>
      </div>
    </Section>
  );
}

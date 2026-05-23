import Link from "next/link";
import Image from "next/image";
import { Container } from "./Container";
import { StripRule } from "./StripRule";
import { Eyebrow } from "./Eyebrow";

export function Footer() {
  return (
    <footer className="relative bg-purple-950 text-bone mt-auto overflow-hidden">
      <Image
        src="/logo.png"
        alt=""
        aria-hidden="true"
        width={720}
        height={720}
        className="pointer-events-none select-none absolute -right-24 -bottom-24 w-[420px] md:w-[560px] opacity-[0.06]"
      />
      <Container className="relative py-20">
        <StripRule className="mb-12" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <Eyebrow>Visit</Eyebrow>
            <p className="mt-4 font-display text-2xl leading-tight">
              West Des Moines Christian Church
            </p>
            <p className="mt-2 text-bone/80 text-sm leading-relaxed">
              4501 Mills Civic Parkway
              <br />
              West Des Moines, IA 50265
            </p>
          </div>

          <div>
            <Eyebrow>Contact</Eyebrow>
            <p className="mt-4 text-sm text-bone/80 leading-relaxed">
              P.O. Box 66044
              <br />
              Des Moines, IA 50266
            </p>
            <a
              href="mailto:DMFCPresident@gmail.com"
              className="underline-draw mt-3 inline-block text-sm text-bone hover:text-brass transition-colors"
            >
              DMFCPresident@gmail.com
            </a>
          </div>

          <div>
            <Eyebrow>Site</Eyebrow>
            <ul className="mt-4 space-y-2 text-sm text-bone/80">
              <li>
                <Link href="/observe" className="underline-draw hover:text-brass transition-colors">
                  Observe a Class
                </Link>
              </li>
              <li>
                <Link href="/members" className="underline-draw hover:text-brass transition-colors">
                  Members
                </Link>
              </li>
              <li>
                <Link href="/events" className="underline-draw hover:text-brass transition-colors">
                  Tournaments
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-bone/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs text-bone/60">
          <p>
            &copy; {new Date().getFullYear()} Des Moines Fencing Club &middot; Iowa 501(c)(3) non-profit
          </p>
          <p className="uppercase tracking-[0.15em]">Olympic fencing in central Iowa</p>
        </div>
      </Container>
    </footer>
  );
}

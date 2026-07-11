import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Hr,
  Section,
  Link,
  Preview,
} from "@react-email/components";
import type { WeaponClass } from "@/lib/member-types";

// ─── Subject line (imported by server action) ─────────────────────────────────
export const subject = (firstName: string) =>
  `${firstName} is officially enrolled with DMFC!`;

// ─── Static data ─────────────────────────────────────────────────────────────
const PRESIDENT_EMAIL = "DMFCPresident@gmail.com";

const WEAPON_LABELS: Record<WeaponClass, string> = {
  "foil-youth": "Foil (Youth)",
  "foil-adult": "Foil (Adult)",
  epee: "Épée",
  saber: "Saber",
};

// Waiver header names, matching the headers shown on the enrollment form
// (src/components/membership/MembershipForm.tsx). Kept as local literals here
// rather than importing from the form — the form's headers are private
// constants and this is display copy, not shared logic.
const RULES_OF_CLUB_HEADER = "Rules of the Club";
const ATHLETE_COC_HEADER = "Athlete Code of Conduct";
const PARENT_COC_HEADER = "USA Fencing Parent Code of Conduct";
const PHOTO_RELEASE_HEADER = "Photo & Video Release";
const individualWaiverHeader = (season: string) =>
  `${season} Individual Membership Waiver`;
const maappHeader = (season: string) => `${season} MAAPP Waiver`;

// ─── Styles ──────────────────────────────────────────────────────────────────
const PURPLE = "#680482";
const BRASS = "#C9A84C";

const styles = {
  body: {
    backgroundColor: "#f5f5f5",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    margin: 0,
    padding: 0,
  },
  container: {
    backgroundColor: "#ffffff",
    margin: "32px auto",
    maxWidth: "600px",
    borderRadius: "4px",
    overflow: "hidden",
  },
  header: {
    backgroundColor: PURPLE,
    padding: "32px 40px",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: "24px",
    fontWeight: "700",
    margin: 0,
    lineHeight: "1.2",
  },
  headerSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: "14px",
    margin: "6px 0 0",
  },
  body2: {
    padding: "32px 40px",
  },
  greeting: {
    fontSize: "18px",
    color: "#1a1a1a",
    margin: "0 0 12px",
    fontWeight: "600",
  },
  intro: {
    fontSize: "15px",
    color: "#444",
    lineHeight: "1.6",
    margin: "0 0 24px",
  },
  sectionHeading: {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: BRASS,
    margin: "0 0 12px",
  },
  bulletItem: {
    fontSize: "14px",
    color: "#444",
    lineHeight: "1.6",
    margin: "4px 0",
  },
  infoText: {
    fontSize: "14px",
    color: "#444",
    lineHeight: "1.6",
    margin: "0 0 8px",
  },
  hr: {
    borderColor: "#eeeeee",
    margin: "28px 0",
  },
  footer: {
    padding: "20px 40px",
    backgroundColor: "#f5f5f5",
    borderTop: "1px solid #e5e5e5",
  },
  footerText: {
    fontSize: "12px",
    color: "#999",
    lineHeight: "1.6",
    margin: 0,
  },
  link: {
    color: PURPLE,
  },
};

// ─── Props ───────────────────────────────────────────────────────────────────
export interface MembershipConfirmationProps {
  athleteName: string;
  season: string;
  weaponClasses: WeaponClass[];
  rulesOfClubAgreed: boolean;
  athleteCocAgreed: boolean;
  parentCocAgreed: boolean;
  individualWaiverAgreed: boolean;
  maappAgreed: boolean;
  photoReleaseAgreed: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function MembershipConfirmation({
  athleteName,
  season,
  weaponClasses,
  rulesOfClubAgreed,
  athleteCocAgreed,
  parentCocAgreed,
  individualWaiverAgreed,
  maappAgreed,
  photoReleaseAgreed,
}: MembershipConfirmationProps) {
  const waiversSigned = [
    rulesOfClubAgreed && RULES_OF_CLUB_HEADER,
    athleteCocAgreed && ATHLETE_COC_HEADER,
    parentCocAgreed && PARENT_COC_HEADER,
    individualWaiverAgreed && individualWaiverHeader(season),
    maappAgreed && maappHeader(season),
    photoReleaseAgreed && PHOTO_RELEASE_HEADER,
  ].filter((header): header is string => Boolean(header));

  return (
    <Html lang="en">
      <Head />
      <Body style={styles.body}>
        <Preview>{`${athleteName}'s DMFC membership is confirmed for ${season}.`}</Preview>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Heading style={styles.headerTitle}>
              Des Moines Fencing Club
            </Heading>
            <Text style={styles.headerSub}>Membership Confirmation</Text>
          </Section>

          {/* Body */}
          <Section style={styles.body2}>
            <Text style={styles.greeting}>Welcome to the club!</Text>
            <Text style={styles.intro}>
              {athleteName}&apos;s registration for the {season} season is
              complete. Below is a record of the classes selected and the
              waivers signed as part of enrollment — keep this email for your
              records.
            </Text>

            <Text style={styles.sectionHeading}>Classes</Text>
            {weaponClasses.map((w) => (
              <Text key={w} style={styles.bulletItem}>
                &middot; {WEAPON_LABELS[w]}
              </Text>
            ))}

            <Hr style={styles.hr} />

            <Text style={styles.sectionHeading}>Waivers Signed</Text>
            {waiversSigned.map((header) => (
              <Text key={header} style={styles.bulletItem}>
                &middot; {header}
              </Text>
            ))}

            <Hr style={styles.hr} />

            <Text style={styles.infoText}>
              Need to update athlete info, emergency contacts, or add another
              family member? Just sign in and visit your member dashboard.
            </Text>

            <Text style={styles.infoText}>
              Questions about class schedules or fees? Email us at{" "}
              <Link href={`mailto:${PRESIDENT_EMAIL}`} style={styles.link}>
                {PRESIDENT_EMAIL}
              </Link>
              .
            </Text>

            <Text style={{ ...styles.infoText, marginTop: "20px" }}>
              See you on the strip,
            </Text>
            <Text style={{ ...styles.infoText, marginTop: "4px", fontWeight: "bold" }}>
              The Des Moines Fencing Club
            </Text>
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              West Des Moines Christian Church &middot; 4501 Mills Civic Parkway &middot; West Des Moines, IA 50265
            </Text>
            <Text style={styles.footerText}>
              Questions?{" "}
              <Link href={`mailto:${PRESIDENT_EMAIL}`} style={styles.link}>
                {PRESIDENT_EMAIL}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default MembershipConfirmation;

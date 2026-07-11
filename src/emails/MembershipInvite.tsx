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
  Button,
  Preview,
} from "@react-email/components";

// ─── Subject line (imported by the signup-invite cron pass) ───────────────────
export const subject = (firstName: string) =>
  `Loved having you, ${firstName} — ready to join?`;

// ─── Static data ─────────────────────────────────────────────────────────────
const PRESIDENT_EMAIL = "DMFCPresident@gmail.com";
const SIGNUP_URL =
  "https://www.desmoinesfencingclub.org/login?next=%2Fmember%2Fenroll";

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
  infoText: {
    fontSize: "14px",
    color: "#444",
    lineHeight: "1.6",
    margin: "0 0 8px",
  },
  ctaWrap: {
    margin: "28px 0",
    textAlign: "center" as const,
  },
  ctaButton: {
    backgroundColor: PURPLE,
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "700",
    padding: "14px 32px",
    borderRadius: "4px",
    textDecoration: "none",
    display: "inline-block",
  },
  fallbackText: {
    fontSize: "12px",
    color: "#999",
    lineHeight: "1.6",
    margin: "12px 0 0",
    textAlign: "center" as const,
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
export interface MembershipInviteProps {
  visitorName: string;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function MembershipInvite({ visitorName }: MembershipInviteProps) {
  const firstName = visitorName.split(" ")[0];

  return (
    <Html lang="en">
      <Head />
      <Body style={styles.body}>
        <Preview>{"It was great having you at practice — here's how to join."}</Preview>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Heading style={styles.headerTitle}>
              Des Moines Fencing Club
            </Heading>
            <Text style={styles.headerSub}>Thanks for visiting</Text>
          </Section>

          {/* Body */}
          <Section style={styles.body2}>
            <Text style={styles.greeting}>Hi {firstName}!</Text>
            <Text style={styles.intro}>
              It was great having you at practice. We hope you got a feel for
              what our club is about — and if you liked what you saw,
              membership is open year-round, no need to wait for a new
              season to start.
            </Text>

            <Text style={styles.sectionHeading}>Thinking About Joining?</Text>
            <Text style={styles.infoText}>
              Signing up takes just a few minutes online — athlete info,
              a couple of waivers, and you&apos;re set. Our coaches are also
              happy to answer any questions about age groups, gear, or fees
              before you decide.
            </Text>

            <div style={styles.ctaWrap}>
              <Button href={SIGNUP_URL} style={styles.ctaButton}>
                Join the Club
              </Button>
              <Text style={styles.fallbackText}>
                Or copy this link into your browser: {SIGNUP_URL}
              </Text>
            </div>

            <Hr style={styles.hr} />

            <Text style={styles.infoText}>
              No pressure at all if now isn&apos;t the right time — you&apos;re
              always welcome to come watch another practice first. Just email
              us at{" "}
              <Link href={`mailto:${PRESIDENT_EMAIL}`} style={styles.link}>
                {PRESIDENT_EMAIL}
              </Link>{" "}
              with any questions.
            </Text>

            <Text style={{ ...styles.infoText, marginTop: "20px" }}>
              Hope to see you on the strip again soon,
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

export default MembershipInvite;

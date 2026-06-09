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
import type { SessionSelection, Weapon } from "@/components/ObservationCalendar";

// ─── Subject line (imported by server action) ─────────────────────────────────
export const subject = (firstName: string) =>
  `You're confirmed, ${firstName}! Here's everything for your fencing visit`;

// ─── Static data ─────────────────────────────────────────────────────────────
const PRESIDENT_EMAIL = "DMFCPresident@gmail.com";

const WEAPON_LABELS: Record<Weapon, string> = {
  "foil-youth": "Foil (Youth)",
  "foil-adult": "Foil (Adult)",
  epee: "Épée",
  saber: "Saber",
};

const WEAPON_TIMES: Record<Weapon, string> = {
  "foil-youth": "6:30 – 7:30 PM",
  "foil-adult": "8:00 – 9:00 PM",
  epee: "6:30 – 7:30 PM",
  saber: "6:30 – 7:30 PM",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

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
  sessionCard: {
    backgroundColor: "#f9f6fc",
    border: `1px solid #e8d9f0`,
    borderRadius: "4px",
    padding: "16px 20px",
    marginBottom: "12px",
  },
  sessionDate: {
    fontSize: "16px",
    fontWeight: "700",
    color: PURPLE,
    margin: "0 0 4px",
  },
  sessionMeta: {
    fontSize: "14px",
    color: "#555",
    margin: "2px 0",
  },
  locationBox: {
    backgroundColor: "#f9f9f9",
    borderLeft: `3px solid ${BRASS}`,
    padding: "14px 18px",
    margin: "24px 0",
  },
  locationText: {
    fontSize: "14px",
    color: "#444",
    lineHeight: "1.6",
    margin: 0,
  },
  infoText: {
    fontSize: "14px",
    color: "#444",
    lineHeight: "1.6",
    margin: "0 0 8px",
  },
  bulletItem: {
    fontSize: "14px",
    color: "#444",
    lineHeight: "1.6",
    margin: "4px 0",
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
export interface ObservationConfirmationProps {
  visitorName: string;
  sessions: SessionSelection[];
  partySize: number;
  notes?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function ObservationConfirmation({
  visitorName,
  sessions,
  partySize,
  notes,
}: ObservationConfirmationProps) {
  const firstName = visitorName.split(" ")[0];

  return (
    <Html lang="en">
      <Head />
      <Body style={styles.body}>
        <Preview>{"Your spot is saved — here’s everything you need for your visit."}</Preview>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Heading style={styles.headerTitle}>
              Des Moines Fencing Club
            </Heading>
            <Text style={styles.headerSub}>Observation Confirmation</Text>
          </Section>

          {/* Body */}
          <Section style={styles.body2}>
            <Text style={styles.greeting}>Hi {firstName}!</Text>
            <Text style={styles.intro}>
              You&apos;re all set — and you&apos;re going to love watching this.
              Fencing is one of those sports that has to be seen in person to be
              fully appreciated, and our coaches are genuinely excited to have
              you in. Below are the details for{" "}
              {sessions.length === 1 ? "your session" : "each of your sessions"}.
            </Text>

            {/* Sessions */}
            <Text style={styles.sectionHeading}>
              {sessions.length === 1 ? "Your Session" : "Your Sessions"}
            </Text>

            {sessions.map((s, i) => (
              <div key={i} style={styles.sessionCard}>
                <Text style={styles.sessionDate}>{formatDate(s.date)}</Text>
                <Text style={styles.sessionMeta}>
                  {WEAPON_LABELS[s.weapon]} &nbsp;&middot;&nbsp; {WEAPON_TIMES[s.weapon]}
                </Text>
                <Text style={styles.sessionMeta}>
                  When you arrive, just look for one of our coaches — they&apos;ll be happy
                  to answer questions and help you find a seat.
                </Text>
              </div>
            ))}

            <Text style={styles.infoText}>
              Coaches have been notified and will be expecting you.{" "}
              {partySize > 1
                ? `We have your party size as ${partySize} — feel free to bring everyone!`
                : ""}
            </Text>

            <Hr style={styles.hr} />

            {/* Location */}
            <Text style={styles.sectionHeading}>Location</Text>
            <div style={styles.locationBox}>
              <Text style={{ ...styles.locationText, fontWeight: "bold" }}>
                West Des Moines Christian Church
              </Text>
              <Text style={styles.locationText}>
                4501 Mills Civic Parkway, West Des Moines, IA 50265
              </Text>
              <Text style={{ ...styles.locationText, marginTop: "10px" }}>
                Enter through the doors on the right side when facing the church.
                Parking is available in the lot directly in front of the building.
              </Text>
            </div>

            <Hr style={styles.hr} />

            {/* What to expect */}
            <Text style={styles.sectionHeading}>What to Expect</Text>
            <Text style={styles.bulletItem}>
              &middot; Wear comfortable clothes — you&apos;re just observing, no gear needed.
            </Text>
            <Text style={styles.bulletItem}>
              &middot; Arrive a few minutes early so you can get settled before practice begins.
            </Text>
            <Text style={styles.bulletItem}>
              &middot; Feel free to ask questions — coaches are happy to chat during breaks.
            </Text>

            {notes && (
              <>
                <Hr style={styles.hr} />
                <Text style={styles.sectionHeading}>Your Notes</Text>
                <Text style={styles.infoText}>{notes}</Text>
              </>
            )}

            <Hr style={styles.hr} />
            <Text style={styles.sectionHeading}>Thinking about joining?</Text>
            <Text style={styles.infoText}>
              If you love what you see, membership is open year-round. Our
              coaches are happy to answer questions about the program, age
              groups, and fees after the session — just ask.
            </Text>

            <Hr style={styles.hr} />

            {/* ICS note */}
            <Text style={styles.infoText}>
              📅 Calendar{" "}
              {sessions.length === 1 ? "file" : "files"} attached — add{" "}
              {sessions.length === 1 ? "the session" : "each session"} to your
              calendar with one click.
            </Text>

            <Hr style={styles.hr} />

            {/* Cancellations */}
            <Text style={{ ...styles.infoText, fontWeight: "bold" }}>
              Need to cancel or reschedule?
            </Text>
            <Text style={styles.infoText}>
              Just email us at{" "}
              <Link href={`mailto:${PRESIDENT_EMAIL}`} style={styles.link}>
                {PRESIDENT_EMAIL}
              </Link>{" "}
              and we&apos;ll sort it out.
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

export default ObservationConfirmation;

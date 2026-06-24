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
import type { Weapon } from "@/components/ObservationCalendar";

// ─── Subject line (imported by cron route) ────────────────────────────────────
export const subject = (firstName: string) =>
  `See you tomorrow, ${firstName} — your Des Moines Fencing Club visit`;

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

const WEAPON_FIRST_COACH: Record<Weapon, string> = {
  "foil-youth": "Abbey Freed",
  "foil-adult": "Abbey Freed",
  epee: "Jon Greising",
  saber: "Preston Kirkpatrick",
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
    margin: "0 0 10px",
    fontWeight: "600",
  },
  intro: {
    fontSize: "15px",
    color: "#444",
    lineHeight: "1.6",
    margin: "0 0 28px",
  },
  sectionLabel: {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: BRASS,
    margin: "0 0 12px",
  },
  dateHeading: {
    fontSize: "18px",
    fontWeight: "700",
    color: PURPLE,
    margin: "0 0 16px",
  },
  sessionCard: {
    backgroundColor: "#f9f6fc",
    border: `1px solid #e8d9f0`,
    borderRadius: "4px",
    padding: "14px 18px",
    marginBottom: "10px",
  },
  sessionCardLast: {
    backgroundColor: "#f9f6fc",
    border: `1px solid #e8d9f0`,
    borderRadius: "4px",
    padding: "14px 18px",
    marginBottom: "24px",
  },
  sessionWeapon: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#1a1a1a",
    margin: "0 0 3px",
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
    marginBottom: "24px",
  },
  locationText: {
    fontSize: "14px",
    color: "#444",
    lineHeight: "1.7",
    margin: 0,
  },
  hr: {
    borderColor: "#eeeeee",
    margin: "24px 0",
  },
  bodyText: {
    fontSize: "14px",
    color: "#444",
    lineHeight: "1.6",
    margin: "0 0 8px",
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
export interface ReminderSession {
  date: string;   // YYYY-MM-DD — all sessions in a reminder share the same date
  weapon: Weapon;
}

export interface ObservationReminderProps {
  visitorName: string;
  sessions: ReminderSession[];
  partySize: number;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function ObservationReminder({
  visitorName,
  sessions,
  partySize,
}: ObservationReminderProps) {
  const firstName = visitorName.split(" ")[0];
  // All sessions share the same date — use the first for display
  const visitDate = sessions[0]?.date ?? "";
  const multiSession = sessions.length > 1;

  return (
    <Html lang="en">
      <Head />
      <Body style={styles.body}>
        <Preview>{"Tomorrow's the day. Here's your session info and where to go."}</Preview>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Heading style={styles.headerTitle}>
              Des Moines Fencing Club
            </Heading>
            <Text style={styles.headerSub}>See you tomorrow!</Text>
          </Section>

          {/* Body */}
          <Section style={styles.body2}>
            <Text style={styles.greeting}>Hey {firstName}!</Text>
            <Text style={styles.intro}>
              Just a quick reminder — your{" "}
              {multiSession ? `${sessions.length} sessions` : "observation"}
              {partySize > 1 ? ` (party of ${partySize})` : ""} {multiSession ? "are" : "is"} tomorrow.
              Come ready to watch the footwork patterns and blade reads happen
              in real time. Our coaches are looking forward to it.
            </Text>

            {/* Session(s) */}
            <Text style={styles.sectionLabel}>
              {multiSession ? "Your Sessions" : "Session Details"}
            </Text>
            <Text style={styles.dateHeading}>{formatDate(visitDate)}</Text>

            {sessions.map((session, i) => (
              <div
                key={i}
                style={i < sessions.length - 1 ? styles.sessionCard : styles.sessionCardLast}
              >
                <Text style={styles.sessionWeapon}>{WEAPON_LABELS[session.weapon]}</Text>
                <Text style={styles.sessionMeta}>{WEAPON_TIMES[session.weapon]}</Text>
                <Text style={styles.sessionMeta}>
                  Look for {WEAPON_FIRST_COACH[session.weapon]} when you arrive — they&apos;ll get you sorted.
                </Text>
              </div>
            ))}

            {/* Location */}
            <Text style={styles.sectionLabel}>Where to Go</Text>
            <div style={styles.locationBox}>
              <Text style={{ ...styles.locationText, fontWeight: "bold" }}>
                West Des Moines Christian Church
              </Text>
              <Text style={styles.locationText}>
                4501 Mills Civic Parkway, West Des Moines, IA 50265
              </Text>
              <Text style={{ ...styles.locationText, marginTop: "10px" }}>
                Enter through the doors on the right side when facing the church.
              </Text>
            </div>

            <Text style={styles.bodyText}>
              &middot; Wear comfortable clothes — you&apos;re just observing, no gear needed.
            </Text>
            <Text style={styles.bodyText}>
              &middot; Arrive a few minutes early so you can get settled before class begins.
            </Text>

            <Hr style={styles.hr} />

            <Text style={{ ...styles.bodyText, fontWeight: "bold" }}>
              Need to cancel or make a change?
            </Text>
            <Text style={styles.bodyText}>
              Just email{" "}
              <Link href={`mailto:${PRESIDENT_EMAIL}`} style={styles.link}>
                {PRESIDENT_EMAIL}
              </Link>{" "}
              and we&apos;ll take care of it — no worries at all.
            </Text>

            <Text style={{ ...styles.bodyText, marginTop: "20px" }}>
              See you on the strip,
            </Text>
            <Text style={{ ...styles.bodyText, marginTop: "4px", fontWeight: "bold" }}>
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

export default ObservationReminder;

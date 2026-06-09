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
export const subject = (visitorName: string) =>
  `New observation request from ${visitorName}`;

// ─── Static data ─────────────────────────────────────────────────────────────
const WEAPON_LABELS: Record<Weapon, string> = {
  "foil-youth": "Foil (Youth)",
  "foil-adult": "Foil (Adult)",
  epee: "Épée",
  saber: "Saber",
};

const WEAPON_TIMES: Record<Weapon, string> = {
  "foil-youth": "Monday, 6:30 – 7:30 PM",
  "foil-adult": "Monday, 8:00 – 9:00 PM",
  epee: "Monday, 6:30 – 7:30 PM",
  saber: "Thursday, 6:30 – 7:30 PM",
};

const WEAPON_COACHES: Record<Weapon, string[]> = {
  "foil-youth": ["Abbey Freed", "Taryn Young"],
  "foil-adult": ["Abbey Freed", "Josiah Janecek", "Jon Greising"],
  epee: ["Jon Greising"],
  saber: ["Preston Kirkpatrick", "Trevor Carra"],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
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
    padding: "28px 40px",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: "20px",
    fontWeight: "700",
    margin: 0,
  },
  headerSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: "13px",
    margin: "4px 0 0",
  },
  body2: {
    padding: "28px 40px",
  },
  sectionLabel: {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: BRASS,
    margin: "0 0 10px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    marginBottom: "24px",
  },
  tdLabel: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#555",
    paddingRight: "16px",
    paddingTop: "8px",
    paddingBottom: "8px",
    verticalAlign: "top" as const,
    width: "140px",
    borderBottom: "1px solid #f0f0f0",
  },
  tdValue: {
    fontSize: "14px",
    color: "#1a1a1a",
    paddingTop: "8px",
    paddingBottom: "8px",
    borderBottom: "1px solid #f0f0f0",
  },
  sessionCard: {
    border: `1px solid #e8d9f0`,
    borderLeft: `4px solid ${PURPLE}`,
    borderRadius: "3px",
    padding: "14px 18px",
    marginBottom: "10px",
    backgroundColor: "#faf8fc",
  },
  sessionDate: {
    fontSize: "15px",
    fontWeight: "700",
    color: PURPLE,
    margin: "0 0 4px",
  },
  sessionMeta: {
    fontSize: "13px",
    color: "#555",
    margin: "2px 0",
  },
  sessionCoaches: {
    fontSize: "13px",
    color: "#777",
    margin: "6px 0 0",
    fontStyle: "italic",
  },
  fyi: {
    backgroundColor: "#f0f8f0",
    border: "1px solid #b2d8b2",
    borderLeft: "4px solid #4caf50",
    borderRadius: "3px",
    padding: "12px 16px",
    margin: "0 0 24px",
  },
  fyiLabel: {
    fontSize: "11px",
    fontWeight: "700" as const,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "#2e7d32",
    margin: "0 0 4px",
  },
  fyiText: {
    fontSize: "13px",
    color: "#444",
    lineHeight: "1.5",
    margin: 0,
  },
  noteBox: {
    backgroundColor: "#fffbf0",
    border: `1px solid ${BRASS}`,
    borderRadius: "3px",
    padding: "12px 16px",
    margin: "0 0 24px",
  },
  noteText: {
    fontSize: "14px",
    color: "#555",
    lineHeight: "1.6",
    margin: 0,
  },
  hr: {
    borderColor: "#eeeeee",
    margin: "24px 0",
  },
  metaText: {
    fontSize: "12px",
    color: "#999",
    margin: 0,
  },
  link: {
    color: PURPLE,
  },
  footer: {
    padding: "16px 40px",
    backgroundColor: "#f5f5f5",
    borderTop: "1px solid #e5e5e5",
  },
  footerText: {
    fontSize: "12px",
    color: "#aaa",
    margin: 0,
  },
};

// ─── Props ───────────────────────────────────────────────────────────────────
export interface ObservationNotificationProps {
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  visitorType: "athlete" | "parent";
  childName?: string;
  sessions: SessionSelection[];
  partySize: number;
  notes?: string;
  submittedAt: string; // ISO timestamp
}

// ─── Component ───────────────────────────────────────────────────────────────
export function ObservationNotification({
  visitorName,
  visitorEmail,
  visitorPhone,
  visitorType,
  childName,
  sessions,
  partySize,
  notes,
  submittedAt,
}: ObservationNotificationProps) {
  const visitorTypeLabel =
    visitorType === "parent"
      ? `Parent / Guardian${childName ? ` (child: ${childName})` : ""}`
      : "Prospective Athlete";

  return (
    <Html lang="en">
      <Head />
      <Body style={styles.body}>
        <Preview>New RSVP from {visitorName} — see sessions and contact details inside.</Preview>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Heading style={styles.headerTitle}>New Observation Request</Heading>
            <Text style={styles.headerSub}>Des Moines Fencing Club · Internal Notification</Text>
          </Section>

          {/* Body */}
          <Section style={styles.body2}>
            {/* FYI banner */}
            <Section style={styles.fyi}>
              <Text style={styles.fyiLabel}>FYI — No action required</Text>
              <Text style={styles.fyiText}>
                A visitor has submitted an observation request through the DMFC website. This is an informational notification only — the visitor has already received a confirmation email with their session details. A calendar event is attached for each requested session.
              </Text>
            </Section>

            {/* Visitor details */}
            <Text style={styles.sectionLabel}>Visitor Details</Text>
            <table style={styles.table}>
              <tbody>
                <tr>
                  <td style={styles.tdLabel}>Name</td>
                  <td style={styles.tdValue}>{visitorName}</td>
                </tr>
                <tr>
                  <td style={styles.tdLabel}>Email</td>
                  <td style={styles.tdValue}>
                    <Link href={`mailto:${visitorEmail}`} style={styles.link}>
                      {visitorEmail}
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td style={styles.tdLabel}>Phone</td>
                  <td style={styles.tdValue}>
                    <Link href={`tel:${visitorPhone.replace(/\D/g, "")}`} style={styles.link}>
                      {visitorPhone}
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td style={styles.tdLabel}>Visitor type</td>
                  <td style={styles.tdValue}>{visitorTypeLabel}</td>
                </tr>
                <tr>
                  <td style={styles.tdLabel}>Party size</td>
                  <td style={styles.tdValue}>{partySize}</td>
                </tr>
              </tbody>
            </table>

            {/* Notes */}
            {notes && (
              <>
                <Text style={styles.sectionLabel}>Notes from Visitor</Text>
                <div style={styles.noteBox}>
                  <Text style={styles.noteText}>{notes}</Text>
                </div>
              </>
            )}

            <Hr style={styles.hr} />

            {/* Sessions */}
            <Text style={styles.sectionLabel}>
              Requested {sessions.length === 1 ? "Session" : `Sessions (${sessions.length})`}
            </Text>

            {sessions.map((s, i) => {
              const coaches = WEAPON_COACHES[s.weapon];
              return (
                <div key={i} style={styles.sessionCard}>
                  <Text style={styles.sessionDate}>{formatDate(s.date)}</Text>
                  <Text style={styles.sessionMeta}>
                    {WEAPON_LABELS[s.weapon]} · {WEAPON_TIMES[s.weapon]}
                  </Text>
                  <Text style={styles.sessionCoaches}>
                    Coaches on: {coaches.join(", ")}
                  </Text>
                </div>
              );
            })}

            <Hr style={styles.hr} />

            <Text style={styles.metaText}>
              Submitted {formatTimestamp(submittedAt)}. A confirmation was also
              sent to{" "}
              <Link href={`mailto:${visitorEmail}`} style={styles.link}>
                {visitorEmail}
              </Link>
              .
            </Text>
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Des Moines Fencing Club · DMFCPresident@gmail.com
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default ObservationNotification;

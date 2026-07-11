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
export const subject = (athleteName: string) =>
  `New member enrollment: ${athleteName}`;

// ─── Static data ─────────────────────────────────────────────────────────────
const WEAPON_LABELS: Record<WeaponClass, string> = {
  "foil-youth": "Foil (Youth)",
  "foil-adult": "Foil (Adult)",
  epee: "Épée",
  saber: "Saber",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
  bulletItem: {
    fontSize: "14px",
    color: "#1a1a1a",
    lineHeight: "1.6",
    margin: "4px 0",
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
export interface MembershipNotificationProps {
  athleteName: string;
  contactEmail: string;
  contactPhone: string;
  weaponClasses: WeaponClass[];
  season: string;
  submittedAt: string; // ISO timestamp
}

// ─── Component ───────────────────────────────────────────────────────────────
export function MembershipNotification({
  athleteName,
  contactEmail,
  contactPhone,
  weaponClasses,
  season,
  submittedAt,
}: MembershipNotificationProps) {
  return (
    <Html lang="en">
      <Head />
      <Body style={styles.body}>
        <Preview>New member enrollment from {athleteName} — see classes and contact details inside.</Preview>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Heading style={styles.headerTitle}>New Member Enrollment</Heading>
            <Text style={styles.headerSub}>Des Moines Fencing Club · Internal Notification</Text>
          </Section>

          {/* Body */}
          <Section style={styles.body2}>
            {/* FYI banner */}
            <Section style={styles.fyi}>
              <Text style={styles.fyiLabel}>FYI — No action required</Text>
              <Text style={styles.fyiText}>
                A new member has completed enrollment through the DMFC website.
                This is an informational notification only — the member has
                already received a confirmation email with their waiver and
                class details.
              </Text>
            </Section>

            {/* Member details */}
            <Text style={styles.sectionLabel}>Member Details</Text>
            <table style={styles.table}>
              <tbody>
                <tr>
                  <td style={styles.tdLabel}>Name</td>
                  <td style={styles.tdValue}>{athleteName}</td>
                </tr>
                <tr>
                  <td style={styles.tdLabel}>Email</td>
                  <td style={styles.tdValue}>
                    <Link href={`mailto:${contactEmail}`} style={styles.link}>
                      {contactEmail}
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td style={styles.tdLabel}>Phone</td>
                  <td style={styles.tdValue}>
                    <Link href={`tel:${contactPhone.replace(/\D/g, "")}`} style={styles.link}>
                      {contactPhone}
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td style={styles.tdLabel}>Season</td>
                  <td style={styles.tdValue}>{season}</td>
                </tr>
              </tbody>
            </table>

            <Hr style={styles.hr} />

            {/* Classes */}
            <Text style={styles.sectionLabel}>
              {weaponClasses.length === 1 ? "Class" : "Classes"}
            </Text>
            {weaponClasses.map((w) => (
              <Text key={w} style={styles.bulletItem}>
                &middot; {WEAPON_LABELS[w]}
              </Text>
            ))}

            <Hr style={styles.hr} />

            <Text style={styles.metaText}>
              Submitted {formatTimestamp(submittedAt)}. A confirmation was also
              sent to{" "}
              <Link href={`mailto:${contactEmail}`} style={styles.link}>
                {contactEmail}
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

export default MembershipNotification;

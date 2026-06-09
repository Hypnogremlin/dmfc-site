export type Weapon = "foil-youth" | "foil-adult" | "epee" | "saber";

const WEAPON_LABELS: Record<Weapon, string> = {
  "foil-youth": "Foil (Youth)",
  "foil-adult": "Foil (Adult)",
  epee: "Épée",
  saber: "Saber",
};

// Local start/end times (America/Chicago) for each weapon
const WEAPON_TIMES: Record<Weapon, { start: string; end: string }> = {
  "foil-youth": { start: "183000", end: "193000" },
  "foil-adult": { start: "200000", end: "210000" },
  epee:         { start: "183000", end: "193000" },
  saber:        { start: "183000", end: "193000" },
};

const LOCATION = "4501 Mills Civic Parkway\\, West Des Moines\\, IA 50265";

/** Format YYYYMMDD from a YYYY-MM-DD date string */
function compactDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

/** Naive timestamp escape for ICS text values */
function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export interface VisitorInfo {
  name: string;
  email: string;
  phone?: string;
  partySize?: number;
  notes?: string;
}

export function generateIcs(date: string, weapon: Weapon, visitor?: VisitorInfo): string {
  const compact = compactDate(date);
  const times = WEAPON_TIMES[weapon];
  const label = WEAPON_LABELS[weapon];
  const uid = `${date}-${weapon}@desmoinesfencingclub.org`;

  const summary = visitor
    ? escapeText(`DMFC Observation – ${visitor.name} (${label})`)
    : escapeText(`DMFC Observation – ${label}`);

  let description: string;
  if (visitor) {
    const parts = [`Visitor: ${visitor.name}`, `Email: ${visitor.email}`];
    if (visitor.phone) parts.push(`Phone: ${visitor.phone}`);
    if (visitor.partySize && visitor.partySize > 1) parts.push(`Party size: ${visitor.partySize}`);
    if (visitor.notes) parts.push(`Notes: ${visitor.notes}`);
    description = escapeText(parts.join("\n"));
  } else {
    description = "Des Moines Fencing Club observation visit. Wear comfortable clothes — you're just watching. Arrive a few minutes early.";
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Des Moines Fencing Club//Observation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:America/Chicago",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:-0600",
    "TZOFFSETTO:-0500",
    "TZNAME:CDT",
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0600",
    "TZNAME:CST",
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART;TZID=America/Chicago:${compact}T${times.start}`,
    `DTEND;TZID=America/Chicago:${compact}T${times.end}`,
    `SUMMARY:${summary}`,
    `LOCATION:${LOCATION}`,
    `DESCRIPTION:${description}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n") + "\r\n";
}

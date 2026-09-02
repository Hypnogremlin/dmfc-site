// Combines separate date/time form inputs into a timestamptz-ready ISO
// string, and splits one back apart for editing. Paired date+time inputs
// were chosen over a single `datetime-local` input because this codebase has
// no `datetime-local` precedent and that input type renders inconsistently
// across browsers; a plain `type="date"` input is already used for the
// membership form's birthday field (src/components/membership/MembershipForm.tsx).
//
// Everything here interprets and renders wall-clock times in the club's own
// timezone, never the running process's. combineDateTime() is called from a
// "use server" action (src/app/member/staff/actions.ts), and Vercel's Node
// runtime is UTC — so `new Date(`${date}T${time}`)`, which JS parses as
// *process-local* time, silently stored a coach's 9:00 AM as 09:00Z, i.e.
// 3:00 AM Central. It looked right on the staff screens only because those
// are server components formatting with a bare toLocaleTimeString (also
// UTC), so the write error and the read error cancelled out; the one client
// component (SlotCard) rendered the true 3 AM and produced a hydration
// mismatch besides. Pinning both ends to America/Chicago is the fix.
//
// There is existing precedent for hard-coding this zone: src/lib/ics.ts
// emits TZID:America/Chicago for class calendar invites.

export const CLUB_TIME_ZONE = "America/Chicago";

// Wall-clock parts of an instant, as seen in the club's timezone. Intl is
// the only timezone database available without adding a dependency, and
// formatToParts is the supported way to read numbers back out of it.
const PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: CLUB_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type ClubParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function clubPartsOf(instantMs: number): ClubParts {
  const parts = PARTS_FORMATTER.formatToParts(new Date(instantMs));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

// Milliseconds Chicago is ahead of UTC at a given instant: negative here
// always (-5h CDT, -6h CST). Derived rather than hard-coded so DST is the
// timezone database's problem, not ours.
function clubOffsetMs(instantMs: number): number {
  const p = clubPartsOf(instantMs);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // formatToParts drops sub-second precision; put it back so the offset is
  // an exact whole-minute value rather than off by up to 999ms.
  return asIfUtc - (instantMs - (instantMs % 1000));
}

// Chicago wall-clock -> the UTC instant it names.
//
// Two passes: the first offset lookup uses the wall-clock numbers read as if
// they were UTC, which lands within a day of the true instant — close enough
// that its offset is right except within the DST transition hour itself. The
// second pass re-reads the offset at the candidate instant and corrects for
// that. On a spring-forward gap (2:30 AM on the second Sunday in March, a
// time that does not exist) the two passes disagree and this resolves to the
// post-transition instant; on a fall-back repeat it picks the first (CDT)
// occurrence. Neither matters for a volunteer shift, but the behavior is
// defined rather than accidental.
function clubWallClockToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): number {
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute);
  let instant = asIfUtc - clubOffsetMs(asIfUtc);
  instant = asIfUtc - clubOffsetMs(instant);
  return instant;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})(?::\d{2})?$/;

export function combineDateTime(date: string, time: string): string | null {
  if (!date) return null;

  const dateMatch = DATE_RE.exec(date);
  const timeMatch = TIME_RE.exec(time || "00:00");
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  // `new Date()` used to reject an out-of-range value like "2026-02-31" for
  // us; Date.UTC would silently roll it over into March instead, so the
  // range check is explicit now.
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59) return null;
  const rolled = new Date(Date.UTC(year, month - 1, day));
  if (rolled.getUTCMonth() !== month - 1 || rolled.getUTCDate() !== day) return null;

  const instant = clubWallClockToUtcMs(year, month, day, hour, minute);
  if (isNaN(instant)) return null;
  return new Date(instant).toISOString();
}

// The exact inverse of combineDateTime: renders a stored UTC timestamp back
// into the Chicago wall-clock date and time a coach originally typed, so the
// edit form round-trips instead of drifting six hours earlier each save.
export function splitDateTime(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const ms = new Date(iso).getTime();
  if (isNaN(ms)) return { date: "", time: "" };
  const p = clubPartsOf(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
  };
}

// --- Display helpers -------------------------------------------------------
//
// Every screen that renders an event or slot timestamp goes through these,
// rather than repeating `timeZone: CLUB_TIME_ZONE` at ten call sites and
// eventually forgetting it at one. Pinning the zone also makes SSR and the
// client agree, which is what keeps SlotCard (the one "use client" consumer)
// from hydration-mismatching.
//
// Note these are deliberately NOT used for date-only values stored as UTC
// midnight — /observe's date, a tournament date, a news post's date — which
// correctly format with `timeZone: "UTC"` at their own call sites.

export function formatClubDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: CLUB_TIME_ZONE,
  });
}

export function formatClubDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: CLUB_TIME_ZONE,
  });
}

export function formatClubTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: CLUB_TIME_ZONE,
  });
}

// A slot with no start_at has no time to show; a slot with a start but no
// end shows just the start. Returning null (not an empty string) lets the
// caller drop the element entirely.
export function formatClubTimeRange(
  startAt: string | null,
  endsAt: string | null
): string | null {
  if (!startAt) return null;
  return endsAt
    ? `${formatClubTime(startAt)} – ${formatClubTime(endsAt)}`
    : formatClubTime(startAt);
}

export function formatClubMonthShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    timeZone: CLUB_TIME_ZONE,
  });
}

export function formatClubDayNumber(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    timeZone: CLUB_TIME_ZONE,
  });
}

// Every calendar day an event spans, inclusive, as plain "YYYY-MM-DD"
// strings — the set SlotEditor offers a coach to pick a slot's day from,
// instead of a full date picker per slot. `new Date(y, m-1, d)` (not
// `new Date(dateString)`) throughout: parsing a bare "YYYY-MM-DD" string is
// UTC midnight, and formatting/iterating that in a browser west of UTC (this
// club is US Central) can land on the wrong calendar day — the local-time
// constructor sidesteps that.
//
// This one is genuinely timezone-independent and was NOT part of the
// combineDateTime bug: it only ever puts calendar numbers in and reads the
// same calendar numbers back out, so whatever zone the process runs in
// cancels out. (The one theoretical hazard, a zone where local midnight
// doesn't exist on a DST day, isn't one here — the US springs forward at
// 2 AM.) Left as-is deliberately.
//
// Capped at 31 days: a genuine multi-day event only ever spans a long
// weekend for this club, so a wildly larger range almost certainly means a
// typo'd end date. Falling back to "just the start day" avoids rendering a
// runaway list of options — the mistake is caught anyway once the coach
// looks at the event's own date fields (or by the ends_at >= starts_at
// validation if the typo went the other direction).
const MAX_EVENT_DAYS = 31;

export function datesInRange(startDate: string, endDate: string): string[] {
  if (!startDate) return [];
  if (!endDate || endDate <= startDate) return [startDate];

  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const cursor = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  const dates: string[] = [];
  while (cursor <= end && dates.length < MAX_EVENT_DAYS) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates.length > 0 ? dates : [startDate];
}

// Resolves the calendar day a slot actually falls on. For a single-day
// event there is only one possible answer regardless of what's stored on
// the slot draft — this covers a slot duplicated from "Duplicate event"
// (which deliberately drops dates, see duplicateSlotDraft) or one added
// before the event's own dates were filled in, neither of which the coach
// can fix by hand since SlotEditor hides the day picker entirely once an
// event only spans one day. For a multi-day event the coach's own pick is
// authoritative and passes through unchanged. Used at both the point a
// slot's timestamps are validated and where they're written to the
// database, so the two can never disagree about what "the slot's date" is.
export function effectiveSlotDate(
  slotDate: string,
  eventStartDate: string,
  eventEndDate: string
): string {
  const days = datesInRange(eventStartDate, eventEndDate);
  return days.length === 1 ? days[0] : slotDate;
}

// Short label for a day-picker option, e.g. "Fri, Nov 6". Takes a plain
// "YYYY-MM-DD" calendar day, not an instant, so it builds a local-midnight
// Date and formats it in that same local zone — the two cancel and the
// weekday is right in any process timezone. See the note on datesInRange.
// Passing timeZone: CLUB_TIME_ZONE here would be actively wrong: it would
// reinterpret a UTC-run process's local midnight as 6 PM the previous day.
export function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ISO cutoff for "still upcoming," used to keep past volunteer events out of
// the member-facing list and unread badge. Midnight *today in Chicago*, not
// "now," so an event starting at 8am doesn't vanish from the list at 9am.
//
// This previously used `d.setHours(0,0,0,0)` — process-local midnight — with
// a comment calling the resulting drift on Vercel (UTC) safe because it errs
// toward showing an event too long. That reasoning was sound but is now
// moot: with a club timezone already established above, computing the real
// Chicago midnight is a two-line change and removes the special case, so the
// cutoff is now exactly right instead of merely erring in a safe direction.
export function upcomingCutoffIso(): string {
  const p = clubPartsOf(Date.now());
  return new Date(clubWallClockToUtcMs(p.year, p.month, p.day, 0, 0)).toISOString();
}

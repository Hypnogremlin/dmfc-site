// Combines separate date/time form inputs into a timestamptz-ready ISO
// string, and splits one back apart for editing. Paired date+time inputs
// were chosen over a single `datetime-local` input because this codebase has
// no `datetime-local` precedent and that input type renders inconsistently
// across browsers; a plain `type="date"` input is already used for the
// membership form's birthday field (src/components/membership/MembershipForm.tsx).
//
// `new Date(`${date}T${time}`)` (no trailing "Z") is parsed by JS as local
// wall-clock time, which is what a coach filling out "this shift starts at
// 9am" means — .toISOString() then converts that to the UTC value Postgres
// stores.

export function combineDateTime(date: string, time: string): string | null {
  if (!date) return null;
  const parsed = new Date(`${date}T${time || "00:00"}`);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function splitDateTime(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

// Every calendar day an event spans, inclusive, as plain "YYYY-MM-DD"
// strings — the set SlotEditor offers a coach to pick a slot's day from,
// instead of a full date picker per slot. `new Date(y, m-1, d)` (not
// `new Date(dateString)`) throughout: parsing a bare "YYYY-MM-DD" string is
// UTC midnight, and formatting/iterating that in a browser west of UTC (this
// club is US Central) can land on the wrong calendar day — the local-time
// constructor sidesteps that.
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

// Short label for a day-picker option, e.g. "Fri, Nov 6". See the timezone
// note on datesInRange above for why this doesn't just do
// `new Date(dateStr).toLocaleDateString(...)`.
export function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ISO cutoff for "still upcoming," used to keep past volunteer events out of
// the member-facing list and unread badge. Local midnight today, not "now,"
// so an event starting at 8am doesn't vanish from the list at 9am. Note this
// runs server-side on Vercel (UTC), not in the club's Central timezone — an
// event lingers on the list a few extra hours into the following UTC morning
// rather than disappearing a few hours early. Erring toward showing an event
// slightly too long is the safer direction; nothing else in this codebase
// hard-codes a timezone, so this doesn't either.
export function upcomingCutoffIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

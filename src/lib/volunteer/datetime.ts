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

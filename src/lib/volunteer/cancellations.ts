// Staff-cancelled volunteer signups — the rules shared by the member
// dashboard's unread badge (src/app/member/page.tsx) and the commitments page
// that renders them (src/app/member/volunteer/mine/page.tsx).
//
// These live together because the badge and the list MUST agree. A badge that
// counts a row the list then hides is worse than no badge: the member clicks
// through, sees nothing, and learns to ignore it.
//
// See supabase/migrations/20260901_volunteer_staff_cancellation.sql.

import { upcomingCutoffIso } from "./datetime";

/**
 * The on-screen label of the roster control that clears a whole slot.
 *
 * Exported and shared rather than typed out twice, because two error messages
 * in src/app/member/staff/actions.ts (updateEvent's slot-removal guard and
 * deleteEvent's) send the coach to press it by name. Those messages used to
 * name an action that did not exist anywhere in the app; a shared constant is
 * what stops that from happening again quietly, and it is what
 * src/app/member/staff/actions.test.ts asserts against.
 */
export const SLOT_CANCEL_ACTION_LABEL = "Cancel everyone on this role";

// The minimum a caller has to select for these predicates to work.
export type CancellableSignup = {
  cancelled_at: string | null;
  cancelled_reason: string | null;
};

/**
 * True when the club cancelled this signup, false when the member did (or
 * when it is still live).
 *
 * Keyed on `cancelled_reason`, NOT on `cancelled_by`, and the difference is
 * load-bearing: `cancelled_by` is a FK to `auth.users` with ON DELETE SET
 * NULL, so it goes NULL if the coach who cancelled later leaves the club and
 * their login is deleted. Testing it would silently reclassify an old staff
 * cancellation as a member's own — and a member's own cancellation is
 * rendered nowhere, so the row would disappear from their dashboard months
 * later with no explanation. `cancelled_reason` is written by both staff RPCs,
 * never by the member RPC, refused when blank at the database (see that
 * migration's CHECK constraint), and never cleared.
 */
export function isStaffCancelled(row: CancellableSignup): boolean {
  return row.cancelled_at !== null && row.cancelled_reason !== null;
}

/**
 * Whether a staff-cancelled signup is still worth showing.
 *
 * Bounded by the same "still upcoming" cutoff the commitments page already
 * splits on, so this list cannot accumulate forever — and so a member who has
 * never opened the page isn't badged with every cancellation in club history.
 * A cancelled shift that has already come and gone is not something the
 * member can act on; the only reason to surface a cancellation at all is so
 * they don't turn up to a shift that no longer exists.
 *
 * A slot with no start_at counts as in scope, matching the /mine page's own
 * treatment of an undated commitment as upcoming: there is no date to say
 * otherwise, and hiding it would be a guess in the destructive direction.
 */
export function isCancellationInScope(
  slotStartAt: string | null,
  cutoff: string = upcomingCutoffIso()
): boolean {
  return !slotStartAt || slotStartAt >= cutoff;
}

/**
 * Whether the member has seen this cancellation yet.
 *
 * NULL `seenAt` (never opened /member/volunteer/mine) counts everything in
 * scope as unread rather than nothing — the same stance
 * `volunteer_last_seen_at` takes for the new-requests badge in
 * src/app/member/page.tsx. A fresh account should not have to guess.
 */
export function isUnreadCancellation(
  cancelledAt: string | null,
  seenAt: string | null | undefined
): boolean {
  if (!cancelledAt) return false;
  if (!seenAt) return true;
  return cancelledAt > seenAt;
}

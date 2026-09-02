-- Volunteer system, M4 (partial) — staff-side cancellation of a signup.
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new
--
-- STATUS: APPLIED 2026-09-01 via the Supabase MCP (ledger: volunteer_staff_cancellation).
-- Verified post-apply with eight behavioural tests; see the README row. DO NOT RE-RUN.
-- Written 2026-09-01. Per this
-- folder's convention, migrations are applied by the owner, never by an agent.
-- Assumes 20260831_volunteer_guardian_profile_rpc.sql has already been applied
-- (it is dated before this file and rewrites claim_volunteer_slot). Nothing
-- here touches claim_volunteer_slot, cancel_volunteer_signup, event_roster,
-- create_guardian_profile, or any trigger — see "What this file does NOT
-- touch" below, which matters for the two standing regression checks.
--
-- WHY THIS FILE EXISTS
--
-- Until now the club had no way to remove a volunteer from a slot, and two
-- staff-facing error messages told a coach to do exactly that:
--   * deleteEvent()  — "Cancel their signups before deleting it."
--   * updateEvent()  — deliberately avoided that wording, and its comment
--                      block asserted "there is no staff-side cancellation
--                      anywhere in the app." Both are fixed in
--                      src/app/member/staff/actions.ts alongside this file.
--
-- GROUND TRUTH READ LIVE 2026-09-01 (read-only catalog queries, no writes):
--
--   * public.volunteer_signups columns are exactly: id, slot_id, account_id,
--     attendee_profile_id, attendee_name, credit_profile_id, attended,
--     credited_hours, notes, created_at, cancelled_at. There is no
--     cancelled_by and no cancelled_reason.
--   * public.account_settings columns are exactly: id, role,
--     volunteer_emails_enabled, unsubscribe_token, volunteer_last_seen_at,
--     created_at, role_updated_at, role_updated_by. There is no
--     "cancellations seen" marker.
--   * pg_get_functiondef(cancel_volunteer_signup) shows its authorization
--     test is:
--         IF v_account <> v_uid AND NOT public.has_role_at_least('coach')
--     — i.e. LIVE ALREADY LETS A COACH CANCEL ANY SIGNUP through the member
--     RPC. That is worth stating plainly because it contradicts the obvious
--     reading of the app code (cancelSignup is only ever called from the
--     member's own SlotCard). What live does NOT have is any record of WHO
--     cancelled or WHY — a staff cancellation and a member's own "I changed
--     my mind" are byte-identical afterwards, and the volunteer is told
--     nothing. That indistinguishability, not the permission, is the actual
--     hole this file closes.
--
-- WHY A NEW FUNCTION RATHER THAN WIDENING cancel_volunteer_signup
--
-- The member RPC is small, verified, and answers one question: "is this your
-- signup?" This one answers a different question ("are you staff?") and, on a
-- yes, writes attribution and a reason that the member path must never write.
-- Folding both authorization models into one function means every future edit
-- has to keep two callers' invariants straight in one body — which is exactly
-- how a member-path change quietly widens the staff path, or vice versa. Two
-- functions, two gates, two test surfaces. The member RPC is untouched here.
--
-- WHAT THIS FILE DOES NOT TOUCH — relevant to the two standing regression
-- checks the README records:
--
--   1. "An ordinary member self-update of account_settings must still
--      succeed." Part 2 adds a COLUMN to account_settings but does not touch
--      prevent_self_role_change(), whose ELSIF pins role_updated_at /
--      role_updated_by only and passes every other column through untouched.
--      A member self-update of the new column therefore takes exactly the
--      same path volunteer_last_seen_at already takes. It is still worth
--      re-running the check post-apply (item 6 below) because the app now
--      writes a SECOND column from that same discard-its-own-errors call
--      site: markVolunteerCancellationsSeen() in
--      src/app/member/volunteer/actions.ts is modelled on markVolunteerSeen()
--      and, like it, throws its error away. A silent break there is invisible.
--
--   2. "A real member signup must still work end to end." Nothing here
--      touches claim_volunteer_slot, the profiles insert trigger from the
--      08-31 file, or any policy. The new columns are nullable with no
--      default and no constraint that an INSERT could violate, so an existing
--      INSERT ... (slot_id, account_id, ...) is unaffected. Re-run it anyway
--      post-apply (item 7) — it is cheap and this file is the first to add a
--      constraint of any kind to volunteer_signups.
--
-- NO EMAIL. This file sends nothing and neither does the UI built on it. The
-- staff screen says so at the point of action, in as many words, and tells the
-- coach to message the person directly. Notification is a later milestone; do
-- not let a future reader infer from "cancelled_reason" that the reason is
-- delivered anywhere except the volunteer's own dashboard.
--
-- Idempotent throughout: ADD COLUMN IF NOT EXISTS, a pg_constraint-guarded DO
-- block for the CHECK, CREATE OR REPLACE FUNCTION. Both new functions are new
-- names, so no DROP is owed and no existing grant is discarded.
--
-- REVOKE pattern per supabase/migrations/README.md's corrected lesson: this
-- project's public-schema default privileges grant EXECUTE directly to anon /
-- authenticated at creation time, so `REVOKE ... FROM PUBLIC` alone does
-- NOTHING. Every REVOKE below names `anon` explicitly. Verify with
-- has_function_privilege() for anon and authenticated SEPARATELY — checking
-- only `authenticated` is precisely how the M3 anon gap survived for days.


-- ---------------------------------------------------------------------------
-- Part 1 — who cancelled, and why
-- ---------------------------------------------------------------------------
-- cancelled_at alone cannot tell a volunteer why their shift disappeared, and
-- cannot tell a coach whether the volunteer released the spot or the club took
-- it back. Two columns, both nullable, both written only by Part 3/Part 4.
--
-- ON DELETE SET NULL on cancelled_by, deliberately, and for the same reason
-- 20260829_roles_and_nonathlete_profiles.sql chose it for
-- account_settings.role_updated_by:
--
--   * CASCADE would delete the SIGNUP ROW — the volunteer's own commitment
--     record, and the only evidence the cancellation ever happened — whenever
--     the coach who cancelled it leaves the club and their login is removed.
--     A departing coach must not be able to erase other people's history by
--     leaving. This is the strictly worse failure and it is silent.
--   * NO ACTION / RESTRICT would make deleting a departed coach's auth.users
--     row fail outright, turning offboarding into a data-surgery task.
--   * SET NULL keeps the row, keeps cancelled_at, and keeps
--     cancelled_reason — which is the part the volunteer actually reads. Only
--     the attribution is lost, and only for a person who no longer exists.
--
-- CONSEQUENCE, and the reason the discriminator below is NOT cancelled_by:
-- because cancelled_by can become NULL long after the fact, "cancelled_by IS
-- NOT NULL" is not a stable test for "staff cancelled this." A deleted coach
-- login would silently reclassify a staff cancellation as a member's own
-- cancellation, and the row would vanish from the volunteer's dashboard with
-- no explanation — the exact outcome this whole change exists to prevent.
--
--   THE DISCRIMINATOR IS `cancelled_reason IS NOT NULL`.
--
-- It is safe as one: the member path (cancel_volunteer_signup) never writes
-- cancelled_reason, both staff paths always do, both refuse a blank one, and
-- the CHECK below makes a whitespace-only reason unrepresentable. Application
-- code (src/lib/volunteer/cancellations.ts) uses this same test; keep the two
-- in step.
ALTER TABLE public.volunteer_signups
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.volunteer_signups
  ADD COLUMN IF NOT EXISTS cancelled_reason text;

-- A blank-but-present reason would be a row that reads as staff-cancelled and
-- explains nothing. The RPCs already refuse one; this makes it unrepresentable
-- regardless of how the row was written (SQL editor, service role, a future
-- RPC). Guarded rather than ADD CONSTRAINT IF NOT EXISTS, which Postgres does
-- not support for table constraints.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.volunteer_signups'::regclass
      AND conname  = 'volunteer_signups_cancelled_reason_not_blank'
  ) THEN
    ALTER TABLE public.volunteer_signups
      ADD CONSTRAINT volunteer_signups_cancelled_reason_not_blank
      CHECK (cancelled_reason IS NULL OR btrim(cancelled_reason) <> '');
  END IF;
END
$$;

-- Feeds the volunteer's "cancelled by DMFC" list and its unread badge, both of
-- which read only a member's OWN rows (the "Members read own signups" policy
-- from M3 already scopes that). Partial: cancelled rows are a small minority
-- and every query that uses it filters on cancelled_reason IS NOT NULL.
CREATE INDEX IF NOT EXISTS volunteer_signups_staff_cancelled_idx
  ON public.volunteer_signups (account_id, cancelled_at)
  WHERE cancelled_reason IS NOT NULL;


-- ---------------------------------------------------------------------------
-- Part 2 — account_settings.volunteer_cancellations_seen_at
-- ---------------------------------------------------------------------------
-- The unread badge on the member dashboard, modelled on volunteer_last_seen_at
-- (M1) and the badge logic in src/app/member/page.tsx. Without it, a volunteer
-- who never opens /member/volunteer/mine has no signal at all that a shift
-- they committed to was taken away.
--
-- A SEPARATE column from volunteer_last_seen_at, not a reuse of it. Those two
-- mark different things and are stamped by different pages: opening the list
-- of open requests must not silently clear "your shift was cancelled." A
-- shared marker would mean the busiest page in the feature dismisses the one
-- notice that matters most.
--
-- NULL (never visited /member/volunteer/mine) counts every staff cancellation
-- in scope as unread, matching volunteer_last_seen_at's own NULL handling —
-- a fresh account should not have to guess. Scope is bounded by the same
-- upcomingCutoffIso() split the /mine page already uses, so a never-visited
-- account is not badged with every cancellation in club history.
ALTER TABLE public.account_settings
  ADD COLUMN IF NOT EXISTS volunteer_cancellations_seen_at timestamptz;


-- ---------------------------------------------------------------------------
-- Part 3 — staff_cancel_signup(): one volunteer, off one slot
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER because volunteer_signups has NO INSERT/UPDATE/DELETE
-- policy at all (M3, Part 2) — every write to it goes through a definer
-- function by design, and this is one more of them, not an exception.
--
-- Returns boolean, matching cancel_volunteer_signup's intent exactly:
--   true  — cancelled by this call
--   false — was already cancelled; a no-op, and a SUCCESS
-- and RAISEs only for "no such row" or "not authorized." A double-submit
-- (double-click, a retried request, a stale roster page) therefore reports
-- success and does NOT re-stamp cancelled_at / cancelled_by / cancelled_reason
-- — the original cancellation's timestamp and reason are what the volunteer
-- already saw, and moving them would resurface a dismissed notice and rewrite
-- the audit trail. The early RETURN false below is what guarantees that; do
-- not "simplify" it into an unconditional UPDATE with a WHERE cancelled_at IS
-- NULL guard that discards the distinction.
--
-- BLANK REASON IS REFUSED HERE, IN THE DATABASE, not only in the app. The app
-- validates first, purely so the coach gets a sentence instead of a raw
-- Postgres message — but PostgREST is directly reachable by any authenticated
-- coach with a browser console, so the app-layer check is a courtesy and this
-- one is the rule. The reason is the only explanation the volunteer will ever
-- receive (no email is sent), so a cancellation without one is not a partially
-- filled form, it is a shift that vanished for no stated cause.
CREATE OR REPLACE FUNCTION public.staff_cancel_signup(
  p_signup_id uuid,
  p_reason    text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid       uuid := (select auth.uid());
  v_reason    text := btrim(coalesce(p_reason, ''));
  v_cancelled timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Must stay the first authorization statement, like every other coach-gated
  -- RPC in this feature (event_roster, admin_account_list).
  IF NOT public.has_role_at_least('coach') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'a reason is required';
  END IF;

  -- FOR UPDATE so two concurrent cancels of the same row serialize: the second
  -- sees the first's write and reports "already cancelled" rather than racing
  -- it and overwriting the reason. Same pattern as cancel_volunteer_signup.
  SELECT cancelled_at INTO v_cancelled
  FROM public.volunteer_signups WHERE id = p_signup_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'signup not found';
  END IF;

  IF v_cancelled IS NOT NULL THEN
    RETURN false;
  END IF;

  UPDATE public.volunteer_signups
  SET cancelled_at     = now(),
      cancelled_by     = v_uid,
      cancelled_reason = v_reason
  WHERE id = p_signup_id;

  RETURN true;
END;
$$;

REVOKE ALL     ON FUNCTION public.staff_cancel_signup(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.staff_cancel_signup(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.staff_cancel_signup(uuid, text) TO authenticated;


-- ---------------------------------------------------------------------------
-- Part 4 — staff_cancel_slot_signups(): clear a whole slot, atomically
-- ---------------------------------------------------------------------------
-- WHY A SECOND RPC RATHER THAN A LOOP IN THE APP LAYER
--
-- Clearing a slot is what actually unblocks the two things a coach came here
-- to do: remove a slot in updateEvent(), and delete an event. Both are
-- all-or-nothing operations, so the cancellation that precedes them must be
-- too.
--
-- The app layer cannot make it so. The Supabase JS client exposes no
-- transaction — this is the same limitation createEvent()/updateEvent()
-- already accept and document for their sequential per-slot writes. A loop of
-- N staff_cancel_signup() calls that fails at N-1 leaves a slot half-cleared:
-- some volunteers dropped, some not, the coach's own delete still blocked, and
-- nothing to tell them which is which. Recovering means reading the roster and
-- reasoning about a partial state — at exactly the moment they are already
-- being told "no."
--
-- One UPDATE statement is atomic by definition. Either every live signup on
-- the slot is cancelled with the same timestamp and the same reason, or none
-- is. It is also one round trip instead of N.
--
-- Returns the number of signups actually cancelled (0 when the slot was
-- already empty — a no-op success, same stance as Part 3's `false`), so the
-- caller can say "3 volunteers cancelled" rather than guessing.
--
-- WHERE cancelled_at IS NULL is what makes a re-submit a no-op: an
-- already-cancelled row keeps its original timestamp, reason and attribution
-- and is not counted.
CREATE OR REPLACE FUNCTION public.staff_cancel_slot_signups(
  p_slot_id uuid,
  p_reason  text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    uuid := (select auth.uid());
  v_reason text := btrim(coalesce(p_reason, ''));
  v_count  integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT public.has_role_at_least('coach') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'a reason is required';
  END IF;

  -- Lock the slot itself, not the signup rows, so this serializes against
  -- claim_volunteer_slot's own `SELECT ... FROM volunteer_slots FOR UPDATE`.
  -- Without it a member's claim could land between the UPDATE below and the
  -- coach's follow-up slot deletion, and that new signup would then be
  -- HARD-deleted by the ON DELETE CASCADE with no cancelled_at record at all.
  PERFORM 1 FROM public.volunteer_slots WHERE id = p_slot_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'slot not found';
  END IF;

  UPDATE public.volunteer_signups
  SET cancelled_at     = now(),
      cancelled_by     = v_uid,
      cancelled_reason = v_reason
  WHERE slot_id = p_slot_id
    AND cancelled_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL     ON FUNCTION public.staff_cancel_slot_signups(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.staff_cancel_slot_signups(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.staff_cancel_slot_signups(uuid, text) TO authenticated;


-- ---------------------------------------------------------------------------
-- Post-apply verification — what the owner should check
-- ---------------------------------------------------------------------------
-- 1. Columns and constraint exist:
--      SELECT column_name FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='volunteer_signups'
--         AND column_name IN ('cancelled_by','cancelled_reason');   -- 2 rows
--      SELECT column_name FROM information_schema.columns
--       WHERE table_schema='public' AND table_name='account_settings'
--         AND column_name='volunteer_cancellations_seen_at';        -- 1 row
--      SELECT conname FROM pg_constraint
--       WHERE conrelid='public.volunteer_signups'::regclass
--         AND conname='volunteer_signups_cancelled_reason_not_blank';
--
-- 2. The FK is SET NULL, not CASCADE (this is the one that is silently
--    destructive if it is wrong):
--      SELECT confdeltype FROM pg_constraint
--       WHERE conrelid='public.volunteer_signups'::regclass
--         AND confrelid='auth.users'::regclass
--         AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
--                              WHERE attrelid='public.volunteer_signups'::regclass
--                                AND attname='cancelled_by')];
--    Expect 'n' (SET NULL). 'c' would be CASCADE — stop and fix.
--
-- 3. GRANTS — for anon AND authenticated SEPARATELY. This is the check the
--    README exists to insist on:
--      SELECT p.proname,
--             has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_can_execute,
--             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_can_execute
--        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname='public'
--         AND p.proname IN ('staff_cancel_signup','staff_cancel_slot_signups');
--    Expect anon_can_execute = false and auth_can_execute = true for BOTH.
--    A `true` for anon means the REVOKE did not take — do not accept the
--    statement's exit status as proof.
--
-- 4. Role gate behaves, from a real session (auth.uid() is NULL in the SQL
--    editor, which passes these vacuously — impersonate via request.jwt.claims
--    inside a transaction and ROLLBACK):
--      * member-role session calling staff_cancel_signup  -> raises 'not authorized'
--      * coach-role session, blank/whitespace reason      -> raises 'a reason is required'
--      * coach-role session, real reason                  -> returns true, and the row
--        shows cancelled_by = the coach and cancelled_reason = the text
--      * the SAME call again                              -> returns false, and
--        cancelled_at / cancelled_by / cancelled_reason are UNCHANGED
--      * staff_cancel_slot_signups on a slot with 2 live signups -> returns 2;
--        called again -> returns 0, with both rows' original timestamps intact
--
-- 5. The member path is unchanged: cancel_volunteer_signup on a member's own
--    signup still returns true and leaves cancelled_reason NULL — that NULL is
--    what keeps a member's own cancellation invisible on their dashboard.
--
-- 6. STANDING CHECK (README, 20260830 item A) — an ordinary member self-update
--    of account_settings must still succeed, from a session with a non-NULL
--    auth.uid():
--      update account_settings set volunteer_last_seen_at = now() where id = <member>;
--      update account_settings set volunteer_cancellations_seen_at = now() where id = <member>;
--    Both must succeed. The second is the new one, written by
--    markVolunteerCancellationsSeen(), which discards its own errors — a
--    failure there is invisible in the app.
--
-- 7. STANDING CHECK (README, 20260831 note) — a real member signup must still
--    work end to end, from the member UI: /member/volunteer -> an event ->
--    claim a slot. Nothing here touches that path, but this is the first file
--    to add a constraint to volunteer_signups.
--
-- 8. get_advisors: expect the usual authenticated_security_definer_function
--    notes for the two new functions (same shape as claim_volunteer_slot /
--    event_roster / slot_fill_counts) and NO anon warning. Anything else is
--    new and should be read.

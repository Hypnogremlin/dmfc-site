-- =============================================================================
-- WARNING — APPLIED AND HISTORICAL. DO NOT RE-RUN THIS FILE.
-- RETRO-SYNCED 2026-09-01 to match live. Syncing it made it honest, not
-- replayable.
-- =============================================================================
-- This file was applied to live on 2026-08-23 (see the STATUS block below).
-- Until 2026-09-01 the copy in this repo did NOT match what is live, in two
-- security-relevant ways, and would have re-opened both gaps if replayed:
--
--   * Both `volunteer_signups` policies were written here with no `TO` clause
--     — which in Postgres means PUBLIC, including `anon`. Live has carried
--     `TO authenticated` on both since the day they were created.
--   * The three `REVOKE ... FROM PUBLIC` statements do nothing on this
--     project (default privileges grant EXECUTE directly to anon and
--     authenticated, not through PUBLIC). Live had `anon` revoked by name.
--
-- The corrections now folded in come from:
--   * 20260823_volunteer_events_restrict_anon.sql — the `TO authenticated`
--     policy pattern (that file itself only re-created the events /
--     volunteer_slots policies; see the note below on this table's own).
--   * 20260823_volunteer_revoke_anon_function_execute.sql (applied 2026-08-23,
--     same session) — REVOKE EXECUTE ... FROM anon, by name, on all three
--     functions created here.
--
-- Ground truth this sync was written against, read live on 2026-09-01:
--   pg_policies (volunteer_signups)  -> both policies roles = {authenticated}
--   pg_proc.proacl (all 3 functions) -> {postgres=X/postgres,
--                                        authenticated=X/postgres,
--                                        service_role=X/postgres}
--   has_function_privilege()         -> anon = false, authenticated = true
--
-- NOTE ON THE `TO authenticated` CLAUSES: they were NOT added to live by a
-- later migration. The text actually applied on 2026-08-23 (remote ledger
-- version 20260823231015) already contained them — the copy in this repo was
-- an older draft that was never updated after the file was revised during
-- that session. That is why 20260823_volunteer_events_restrict_anon.sql does
-- not mention `volunteer_signups`: there was nothing on this table to fix.
--
-- This file is edited even though it is applied, which this folder's
-- convention normally forbids, because it was actively misleading. NO LIVE
-- CHANGE WAS INVOLVED — nothing was applied on 2026-09-01. It still must not
-- be re-run: `claim_volunteer_slot` is about to be replaced again by
-- 20260831_volunteer_guardian_profile_rpc.sql (pending), and the version
-- below is deliberately the CURRENT LIVE one, not that pending rewrite.
-- =============================================================================

-- Volunteer system, M3 — member signup: volunteer_signups, the two RPCs that
-- are the only way to write to it, and slot_fill_counts(), the only way a
-- member reads capacity across the whole slot rather than just their own row.
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new
--
-- Full design context: VOLUNTEERS.md, sections D6, D7, D12, "Data model", and
-- "Row Level Security". This file implements ONLY M3. Attendance review,
-- credited_hours UI, and the volunteer_hours view are M4 and are deliberately
-- NOT here — the attended/credited_hours columns are created now (the table
-- is schema-complete per VOLUNTEERS.md) but nothing in this milestone writes
-- to them.
--
-- STATUS: APPLIED to live 2026-08-23 via the Supabase MCP (`apply_migration`,
-- recorded in the remote ledger as `volunteer_signups`). Revised earlier the
-- same day after an independent review pass caught that the member-facing
-- SELECT policy on volunteer_signups (correctly scoped to a member's own
-- rows) meant there was no way for a member to see a slot's TRUE fill count
-- — Part 5 (slot_fill_counts) closes that gap. The same pass changed
-- cancel_volunteer_signup's return type from void to boolean so a real
-- failure (wrong owner, bad id) is distinguishable from "already cancelled"
-- instead of both looking like a silent no-op.
--
-- Post-apply verification found that every REVOKE ALL ... FROM PUBLIC below
-- did NOT actually block `anon` from calling these functions — this
-- project's default privileges grant EXECUTE directly to anon/authenticated
-- at function-creation time, independent of PUBLIC. See the corrected
-- lesson in supabase/migrations/README.md and the follow-up fix,
-- 20260823_volunteer_revoke_anon_function_execute.sql, applied the same
-- session. The REVOKE ... FROM PUBLIC statements below were originally left
-- as written (harmless, just insufficient on their own) rather than edited
-- after the fact. As of the 2026-09-01 retro-sync described at the top of
-- this file, the matching `FROM anon` revokes are shown alongside them, so
-- this file states what is actually live. That is a documentation fix, not a
-- new migration: the live change was made by
-- 20260823_volunteer_revoke_anon_function_execute.sql.
--
-- Every statement here is idempotent in the sense that a second run will not
-- ERROR (CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY IF EXISTS before
-- CREATE, CREATE OR REPLACE FUNCTION — except
-- cancel_volunteer_signup, which needs one explicit DROP FUNCTION because
-- CREATE OR REPLACE cannot change a return type; see the comment there).
-- volunteer_signups is owned outright by this project, so the ordinary
-- DROP/CREATE pattern for policies applies without M1's auth.users ownership
-- workaround.

-- ── Part 1 — public.volunteer_signups ────────────────────────────────────────
-- One row per person claiming one slot. `account_id` is the login that made
-- the claim; `attendee_profile_id` is who actually shows up (D7) — they are
-- not always the same profile, and per D3 a first-time guardian claim
-- lazily inserts a profiles row before this insert happens (see the
-- claim_volunteer_slot RPC below, which receives an already-resolved id).
-- `attendee_name` is the free-text fallback for "Someone else…" — the CHECK
-- below requires exactly one identity source per signup, not neither and not
-- (accidentally) validated as both being optional.
-- `credit_profile_id` is nullable and, per the owner's 2026-07-27 decision
-- recorded in VOLUNTEERS.md D7, is not set by any M3 UI — hours roll up to
-- the household only until the board defines a per-member service
-- requirement. The column exists now so that change is a UI decision later,
-- not a schema migration.
-- Rows are soft-deleted via cancelled_at, never hard-deleted, so a coach can
-- see that someone backed out rather than the slot silently looking as if it
-- was never claimed.
CREATE TABLE IF NOT EXISTS public.volunteer_signups (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id             uuid NOT NULL REFERENCES public.volunteer_slots(id) ON DELETE CASCADE,
  account_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attendee_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  attendee_name       text,
  credit_profile_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  attended            boolean,
  credited_hours      numeric(5,2) CHECK (credited_hours IS NULL OR credited_hours >= 0),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  cancelled_at        timestamptz,
  CHECK (attendee_profile_id IS NOT NULL OR attendee_name IS NOT NULL)
);

-- One live signup per attendee per slot; cancelled rows are exempt so a
-- cancel-then-resignup works. Free-text ("Someone else…") attendees are not
-- covered by this index — there's no profile id to key on, so double-booking
-- a free-text name is possible and is accepted as out of scope (the same
-- person typed as "Someone else" twice is a rare, low-stakes edge case, and
-- the slot's own capacity check still caps how many times it can happen).
CREATE UNIQUE INDEX IF NOT EXISTS volunteer_signups_live_idx
  ON public.volunteer_signups (slot_id, attendee_profile_id)
  WHERE cancelled_at IS NULL AND attendee_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS volunteer_signups_account_idx ON public.volunteer_signups (account_id);
CREATE INDEX IF NOT EXISTS volunteer_signups_credit_idx  ON public.volunteer_signups (credit_profile_id);
CREATE INDEX IF NOT EXISTS volunteer_signups_slot_idx    ON public.volunteer_signups (slot_id);

-- ── Part 2 — RLS: public.volunteer_signups ───────────────────────────────────
-- Policy shape, per VOLUNTEERS.md "Row Level Security":
--   SELECT — own rows; coach+ sees all (needed for the roster/attendance
--            screens, M4).
--   INSERT — none at all. claim_volunteer_slot() is SECURITY DEFINER and
--            bypasses RLS entirely, which is the whole point of D12: capacity
--            is enforced by locking the slot row inside the function, not by
--            a read-then-write in application code that two concurrent
--            requests could both pass.
--   UPDATE — none at all. cancel_volunteer_signup() is likewise SECURITY
--            DEFINER. A member-facing UPDATE policy would need a trigger to
--            keep `attended`/`credited_hours` coach-only (RLS is row-, not
--            column-level) — routing every write through these two functions
--            avoids needing that trigger, per D12's "prefer the RPC."
--   DELETE — none. Cancellation is a soft-delete (cancelled_at), not a row
--            delete.
ALTER TABLE public.volunteer_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read own signups" ON public.volunteer_signups;
CREATE POLICY "Members read own signups" ON public.volunteer_signups
  FOR SELECT
  TO authenticated
  USING (account_id = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches and above read all signups" ON public.volunteer_signups;
CREATE POLICY "Coaches and above read all signups" ON public.volunteer_signups
  FOR SELECT
  TO authenticated
  USING (public.has_role_at_least('coach'));

-- ── Part 3 — claim_volunteer_slot(): the only INSERT path ────────────────────
-- SECURITY DEFINER so it can write despite there being no INSERT policy.
-- Locks the slot row FOR UPDATE before counting, so two concurrent claims on
-- the last open spot serialize instead of both reading "1 of 2 taken" and
-- both succeeding (D12). search_path = '' and every reference schema-
-- qualified, per the function_search_path_mutable advisor — same convention
-- as has_role_at_least/prevent_self_role_change in M1.
CREATE OR REPLACE FUNCTION public.claim_volunteer_slot(
  p_slot_id       uuid,
  p_attendee_id   uuid DEFAULT NULL,
  p_attendee_name text DEFAULT NULL,
  p_credit_id     uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid      uuid := (select auth.uid());
  v_capacity integer;
  v_adults   boolean;
  v_taken    integer;
  v_birthday date;
  v_id       uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_attendee_id IS NULL AND (p_attendee_name IS NULL OR btrim(p_attendee_name) = '') THEN
    RAISE EXCEPTION 'an attendee is required';
  END IF;

  -- Lock the slot so a concurrent claim on the same row waits behind this
  -- transaction rather than reading a stale count.
  SELECT capacity, adults_only INTO v_capacity, v_adults
  FROM public.volunteer_slots WHERE id = p_slot_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'slot not found';
  END IF;

  -- The attendee, if a real profile, must belong to the calling account —
  -- otherwise a hand-crafted request could claim a slot "as" a stranger's
  -- profile id.
  IF p_attendee_id IS NOT NULL THEN
    SELECT birthday INTO v_birthday FROM public.profiles
    WHERE id = p_attendee_id AND account_owner_id = v_uid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'attendee not on this account';
    END IF;
  END IF;

  -- A NULL birthday means a guardian row (or a free-text "Someone else…"
  -- attendee, v_birthday stays NULL), which is by definition an adult — see
  -- src/lib/age.ts's isMinor(). Only a minor athlete profile can fail this.
  IF v_adults AND v_birthday IS NOT NULL
     AND v_birthday > (CURRENT_DATE - INTERVAL '18 years') THEN
    RAISE EXCEPTION 'this role is adults only';
  END IF;

  SELECT count(*) INTO v_taken FROM public.volunteer_signups
  WHERE slot_id = p_slot_id AND cancelled_at IS NULL;

  IF v_taken >= v_capacity THEN
    RAISE EXCEPTION 'slot is full';
  END IF;

  INSERT INTO public.volunteer_signups
    (slot_id, account_id, attendee_profile_id, attendee_name, credit_profile_id)
  VALUES (p_slot_id, v_uid, p_attendee_id, NULLIF(btrim(p_attendee_name), ''), p_credit_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- FROM PUBLIC alone is a no-op on this project; `anon` must be named. See
-- supabase/migrations/README.md, "REVOKE FROM PUBLIC does not work on this
-- project". The FROM anon line below was applied by
-- 20260823_volunteer_revoke_anon_function_execute.sql and is folded in here.
REVOKE ALL     ON FUNCTION public.claim_volunteer_slot(uuid, uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_volunteer_slot(uuid, uuid, text, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.claim_volunteer_slot(uuid, uuid, text, uuid) TO authenticated;

-- ── Part 4 — cancel_volunteer_signup(): the only UPDATE path ─────────────────
-- Not in VOLUNTEERS.md's draft SQL (which only sketched the claim RPC) but
-- required by the RLS policy table's "own row for cancel" and by D12's
-- "prefer the RPC" guidance over a member UPDATE policy + trigger pair.
--
-- Returns boolean rather than void so the caller can tell "cancelled just
-- now" (true) from "already cancelled" (false) — both are success, mirroring
-- publishEvent's `.eq("published", false)` treatment of "already done by a
-- double-click" as the outcome the user wanted, not an error — from "not
-- your signup" or "no such row" (both raise, since silently updating 0 rows
-- for those cases would look identical to "already cancelled" and hide a
-- real authorization failure or bad id).
--
-- CREATE OR REPLACE cannot change a function's return type, hence the
-- explicit DROP. This paragraph used to read "this migration has never been
-- applied to live ... so this file stays honestly re-runnable" — that was
-- true when it was written and is false now: the file WAS applied on
-- 2026-08-23, and this folder no longer claims any applied file is
-- re-runnable. Corrected 2026-09-01; see the warning at the top.
DROP FUNCTION IF EXISTS public.cancel_volunteer_signup(uuid);

CREATE FUNCTION public.cancel_volunteer_signup(p_signup_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid       uuid := (select auth.uid());
  v_account   uuid;
  v_cancelled timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- FOR UPDATE so two concurrent cancels of the same row serialize — the
  -- second sees the first's write and reports "already cancelled" (false)
  -- rather than racing it.
  SELECT account_id, cancelled_at INTO v_account, v_cancelled
  FROM public.volunteer_signups WHERE id = p_signup_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'signup not found';
  END IF;

  IF v_account <> v_uid AND NOT public.has_role_at_least('coach') THEN
    RAISE EXCEPTION 'not your signup';
  END IF;

  IF v_cancelled IS NOT NULL THEN
    RETURN false;
  END IF;

  UPDATE public.volunteer_signups SET cancelled_at = now() WHERE id = p_signup_id;
  RETURN true;
END;
$$;

-- DROP FUNCTION discards any grants on the old signature, so this pair must
-- stay immediately after the CREATE, not merely somewhere in the file.
REVOKE ALL     ON FUNCTION public.cancel_volunteer_signup(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_volunteer_signup(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.cancel_volunteer_signup(uuid) TO authenticated;

-- ── Part 5 — slot_fill_counts(): how full is each slot ───────────────────────
-- A member's own SELECT policy on volunteer_signups (Part 2) is scoped to
-- account_id = auth.uid() — by design, so one household can't browse who
-- else signed up. But that means a member-side count of "how many people
-- have claimed this slot" reads only their own signups: a 3-of-3 slot would
-- render as 0/3 filled for everyone except the coach who can see all rows.
-- This is the read-side counterpart to the two write RPCs above: SECURITY
-- DEFINER so it can see every row, but it returns ONLY a count per slot,
-- never who — no identity crosses the boundary RLS was drawing.
-- Event/slot visibility is re-implemented in the WHERE clause below because
-- SECURITY DEFINER bypasses the volunteer_slots SELECT policy that would
-- otherwise enforce "published, or you're coach+."
CREATE OR REPLACE FUNCTION public.slot_fill_counts(p_event_id uuid)
RETURNS TABLE (slot_id uuid, taken integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT sl.id, count(s.id)::integer
  FROM public.volunteer_slots sl
  LEFT JOIN public.volunteer_signups s
    ON s.slot_id = sl.id AND s.cancelled_at IS NULL
  WHERE sl.event_id = p_event_id
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = sl.event_id
        AND (e.published = true OR public.has_role_at_least('coach'))
    )
  GROUP BY sl.id;
$$;

REVOKE ALL     ON FUNCTION public.slot_fill_counts(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.slot_fill_counts(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.slot_fill_counts(uuid) TO authenticated;

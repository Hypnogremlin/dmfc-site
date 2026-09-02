-- =============================================================================
-- WARNING — APPLIED AND HISTORICAL. DO NOT RE-RUN THIS FILE.
-- =============================================================================
-- This file was applied to live on 2026-08-20 (see the STATUS block below) and
-- is kept only as the record of what M2 did on that date. It is NOT a
-- description of the current live schema. Every policy below is written with
-- `DROP POLICY IF EXISTS` / `CREATE POLICY`, so re-running this file would
-- silently undo the fix listed first below and report success. See "Never
-- re-run an applied file" in supabase/migrations/README.md.
--
-- Parts of this file have since been superseded:
--
--   * 20260823_volunteer_events_restrict_anon.sql (applied 2026-08-23) —
--     re-created ALL 9 policies below (5 on events, 4 on volunteer_slots) with
--     `TO authenticated` added. Every policy in this file was written with no
--     `TO` clause, which in Postgres means PUBLIC — including `anon`. Live now
--     shows `roles = {authenticated}` on all 9. **Re-running this file strips
--     that back off and re-exposes published events and slots to anonymous
--     /rest/v1 reads.** This is the single most dangerous thing about this
--     file.
--   * 20260823_volunteer_revoke_anon_function_execute.sql (applied 2026-08-23)
--     and the README's "REVOKE FROM PUBLIC does not work on this project"
--     section — Part 5's `REVOKE ... FROM PUBLIC` pattern does nothing on this
--     project, because default privileges grant EXECUTE directly to
--     anon/authenticated rather than through PUBLIC. Every REVOKE must name
--     the role. Part 5's own comment, which calls the earlier ledger entry
--     `revoke_trigger_function_rpc` a "silent no-op" and prefers FROM PUBLIC,
--     has it exactly backwards; that guidance is what caused the M3 gap. Read
--     the README, not that comment.
--   * 20260829_roles_and_nonathlete_profiles.sql and
--     20260830_roles_hardening_followup.sql — continue the role/person_type
--     work this file's Part 5 touches at the edges (prevent_self_role_change()
--     has been replaced twice since).
-- =============================================================================

-- Volunteer system, M2 — staff CRUD: events and volunteer_slots.
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new
--
-- Full design context: VOLUNTEERS.md, sections D1, D5, D11, D12, "Data model",
-- and "Row Level Security". This file implements ONLY M2 — the staff-facing
-- CRUD surface for creating/editing/publishing/deleting volunteer requests.
-- volunteer_signups, the claim RPC, and the hours view are M3/M4 and are
-- deliberately NOT here.
--
-- STATUS: APPLIED to live 2026-08-20 via the Supabase MCP (`apply_migration`,
-- recorded in the remote ledger as `volunteer_staff_crud`). Verified post-apply:
-- profiles/account_settings row counts unchanged (57/337, 1 elevated account);
-- both new tables created empty; 9 policies present (5 events, 4
-- volunteer_slots — including DELETE on both); events_updated_at confirmed
-- pointing at the existing set_updated_at(); both REVOKEs confirmed via
-- has_function_privilege(); get_advisors shows no findings beyond the
-- pre-existing baseline.
--
-- Unlike M1, this migration touches ZERO existing rows. Every statement below
-- either creates a brand-new table (empty on creation) or revokes an unused
-- permission grant on a function M1 already created. There is no ALTER,
-- UPDATE, or DELETE against `profiles`, `account_settings`, or any other
-- pre-existing table.
--
-- Every statement here is idempotent (IF [NOT] EXISTS, DROP ... IF EXISTS
-- before CREATE) in the sense that a second run will not ERROR. That is not
-- the same as safe — see the warning at the top of this file; do not re-run
-- it, and do not replay this folder from scratch. `events` and
-- `volunteer_slots` are owned outright by
-- this project (unlike `auth.users`), so the ordinary DROP/CREATE pattern for
-- triggers and policies applies here without M1's ownership workaround.

-- ── Part 1 — public.events ───────────────────────────────────────────────────
-- `season` deliberately has NO database default — the server action supplies
-- MEMBERSHIP_SEASON from src/lib/member-types.ts, so there is exactly one
-- place that constant lives (VOLUNTEERS.md, "Data model" > events).
-- `published`/`published_at`: publish is one-way by product decision — the
-- application layer never sets published back to false, and published_at is
-- set exactly once, on that transition. Nothing in this migration enforces
-- that at the database level (no CHECK requiring published_at when published
-- is true, for example) because the one-way rule is a product decision, not a
-- data-integrity one; the server action (Part 5) is the single write path
-- that implements it.
CREATE TABLE IF NOT EXISTS public.events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text,
  location      text,
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz,
  season        text NOT NULL,
  created_by    uuid NOT NULL REFERENCES auth.users(id),
  published     boolean NOT NULL DEFAULT false,
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS events_starts_at_idx ON public.events (starts_at);
-- Composite index for the future member-facing query in M3
-- ("published events, soonest first").
CREATE INDEX IF NOT EXISTS events_published_idx ON public.events (published, starts_at);

-- Reuses the set_updated_at() function already defined in
-- 20260616_phase2_membership.sql (used today by profiles/member_medical) —
-- no new trigger function is written for this.
DROP TRIGGER IF EXISTS events_updated_at ON public.events;
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Part 2 — public.volunteer_slots ──────────────────────────────────────────
-- One row per "need": a role name, an optional time window, and a capacity.
-- ON DELETE CASCADE on event_id is what makes delete-event safe to implement
-- with a single DELETE statement in Part 5 — no manual slot cleanup needed,
-- and (today) nothing downstream to orphan, since volunteer_signups does not
-- exist until M3.
CREATE TABLE IF NOT EXISTS public.volunteer_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  role_name   text NOT NULL,
  notes       text,
  start_at    timestamptz,
  ends_at     timestamptz,
  capacity    integer NOT NULL DEFAULT 1 CHECK (capacity > 0),
  adults_only boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR start_at IS NULL OR ends_at >= start_at)
);

CREATE INDEX IF NOT EXISTS volunteer_slots_event_id_idx ON public.volunteer_slots (event_id);

-- ── Part 3 — RLS: public.events ──────────────────────────────────────────────
-- Policy shape, per the table in VOLUNTEERS.md "Row Level Security":
--   SELECT — published = true to any authenticated user; coach+ also sees
--            drafts (two policies, OR'd together by Postgres's permissive-
--            policy semantics — a row is visible if EITHER matches).
--   INSERT/UPDATE/DELETE — coach+ only. No member-facing write path exists
--            at any layer for this table.
-- Reuses public.has_role_at_least() from M1 — no new role-checking SQL.
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published events are visible to members" ON public.events;
CREATE POLICY "Published events are visible to members" ON public.events
  FOR SELECT
  USING (published = true);

DROP POLICY IF EXISTS "Coaches and above see all events" ON public.events;
CREATE POLICY "Coaches and above see all events" ON public.events
  FOR SELECT
  USING (public.has_role_at_least('coach'));

DROP POLICY IF EXISTS "Coaches and above create events" ON public.events;
CREATE POLICY "Coaches and above create events" ON public.events
  FOR INSERT
  WITH CHECK (public.has_role_at_least('coach') AND created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches and above update events" ON public.events;
CREATE POLICY "Coaches and above update events" ON public.events
  FOR UPDATE
  USING (public.has_role_at_least('coach'))
  WITH CHECK (public.has_role_at_least('coach'));

DROP POLICY IF EXISTS "Coaches and above delete events" ON public.events;
CREATE POLICY "Coaches and above delete events" ON public.events
  FOR DELETE
  USING (public.has_role_at_least('coach'));

-- ── Part 4 — RLS: public.volunteer_slots ─────────────────────────────────────
-- Mirrors the parent event's visibility via an EXISTS subquery, so a slot is
-- never independently more or less visible than the event it belongs to.
ALTER TABLE public.volunteer_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Slots visible with their event" ON public.volunteer_slots;
CREATE POLICY "Slots visible with their event" ON public.volunteer_slots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = volunteer_slots.event_id
        AND (e.published = true OR public.has_role_at_least('coach'))
    )
  );

DROP POLICY IF EXISTS "Coaches and above create slots" ON public.volunteer_slots;
CREATE POLICY "Coaches and above create slots" ON public.volunteer_slots
  FOR INSERT
  WITH CHECK (public.has_role_at_least('coach'));

DROP POLICY IF EXISTS "Coaches and above update slots" ON public.volunteer_slots;
CREATE POLICY "Coaches and above update slots" ON public.volunteer_slots
  FOR UPDATE
  USING (public.has_role_at_least('coach'))
  WITH CHECK (public.has_role_at_least('coach'));

DROP POLICY IF EXISTS "Coaches and above delete slots" ON public.volunteer_slots;
CREATE POLICY "Coaches and above delete slots" ON public.volunteer_slots
  FOR DELETE
  USING (public.has_role_at_least('coach'));

-- ── Part 5 — carried over from M1: two permission cleanups ───────────────────
-- Owed since M1 (see VOLUNTEERS.md "Carry into M2's migration" and
-- supabase/migrations/README.md), deliberately deferred rather than spent as
-- their own production write. Both are trigger functions Supabase's
-- anon_security_definer_function_executable advisor flags as callable via
-- /rest/v1/rpc/... even though calling a trigger function directly already
-- errors — this closes surface area, it does not change behavior.
--
-- Do NOT revoke public.has_role_at_least(account_role) — it is referenced
-- inside RLS policies (Parts 3 and 4 above, plus M1's account_settings
-- policies), and a function used in a policy is evaluated as the querying
-- role; revoking it turns an ordinary member's SELECT into a permission error
-- instead of the intended row-filtered result.
--
-- A first attempt at this (ledger entry `revoke_trigger_function_rpc`,
-- 2026-07-29) named `anon, authenticated` instead of `PUBLIC` and was a
-- silent no-op, per supabase/migrations/README.md. REVOKE reports success
-- even when it removes nothing — verify with has_function_privilege(),
-- never with the statement's own exit status.
REVOKE EXECUTE ON FUNCTION public.handle_new_user_account_settings() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_self_role_change()         FROM PUBLIC;

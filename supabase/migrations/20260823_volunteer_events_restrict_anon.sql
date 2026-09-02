-- Volunteer system — close an anon-read gap on public.events and
-- public.volunteer_slots, both applied live as part of M2 (2026-08-20).
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new
--
-- Found by an independent review of M3 (2026-08-23): every policy in
-- 20260820_volunteer_staff_crud.sql was written with no `TO` clause. In
-- Postgres, a CREATE POLICY with no TO applies to PUBLIC — every role,
-- including `anon`. The four "coach+" policies on each table are safe
-- anyway, because has_role_at_least('coach') reads account_settings by
-- auth.uid(), which is NULL for an anonymous request and so always returns
-- false there. But "Published events are visible to members" on events, and
-- its mirror "Slots visible with their event" on volunteer_slots, have no
-- role check at all — `published = true` is a real grant to anyone hitting
-- PostgREST, not just to signed-in members. VOLUNTEERS.md's "Open questions"
-- section says volunteer requests are "currently member-only" — this was the
-- gap between that stated intent and what the database actually enforced.
--
-- STATUS: APPLIED to live 2026-08-23 via the Supabase MCP (`apply_migration`,
-- recorded in the remote ledger as `volunteer_events_restrict_anon`).
-- Verified post-apply: all 9 policies (5 on events, 4 on volunteer_slots)
-- show `roles = {authenticated}` in pg_policies; no table/column/data change.
--
-- This migration only re-creates existing policies with TO authenticated
-- added — same USING/WITH CHECK expressions as 20260820_volunteer_staff_crud.sql,
-- no table, column, or data change. Every statement is idempotent
-- (DROP POLICY IF EXISTS before CREATE), so re-running this file is safe.
-- Do not fold this back into 20260820_volunteer_staff_crud.sql — that file
-- is already applied to live, and this repo's convention (see
-- supabase/migrations/README.md) is a new dated file per change, never an
-- edit to one already run.

-- ── public.events ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Published events are visible to members" ON public.events;
CREATE POLICY "Published events are visible to members" ON public.events
  FOR SELECT
  TO authenticated
  USING (published = true);

DROP POLICY IF EXISTS "Coaches and above see all events" ON public.events;
CREATE POLICY "Coaches and above see all events" ON public.events
  FOR SELECT
  TO authenticated
  USING (public.has_role_at_least('coach'));

DROP POLICY IF EXISTS "Coaches and above create events" ON public.events;
CREATE POLICY "Coaches and above create events" ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role_at_least('coach') AND created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches and above update events" ON public.events;
CREATE POLICY "Coaches and above update events" ON public.events
  FOR UPDATE
  TO authenticated
  USING (public.has_role_at_least('coach'))
  WITH CHECK (public.has_role_at_least('coach'));

DROP POLICY IF EXISTS "Coaches and above delete events" ON public.events;
CREATE POLICY "Coaches and above delete events" ON public.events
  FOR DELETE
  TO authenticated
  USING (public.has_role_at_least('coach'));

-- ── public.volunteer_slots ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Slots visible with their event" ON public.volunteer_slots;
CREATE POLICY "Slots visible with their event" ON public.volunteer_slots
  FOR SELECT
  TO authenticated
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
  TO authenticated
  WITH CHECK (public.has_role_at_least('coach'));

DROP POLICY IF EXISTS "Coaches and above update slots" ON public.volunteer_slots;
CREATE POLICY "Coaches and above update slots" ON public.volunteer_slots
  FOR UPDATE
  TO authenticated
  USING (public.has_role_at_least('coach'))
  WITH CHECK (public.has_role_at_least('coach'));

DROP POLICY IF EXISTS "Coaches and above delete slots" ON public.volunteer_slots;
CREATE POLICY "Coaches and above delete slots" ON public.volunteer_slots
  FOR DELETE
  TO authenticated
  USING (public.has_role_at_least('coach'));

-- Audit trail for the staff Google Contacts export.
--
-- /api/staff/contacts-export hands a coach the entire current-season roster —
-- names, emails, phones and home addresses, for minors included — as a file
-- that leaves the building. It is the highest-PII action in the app, and
-- until now it left no record that it happened: no row, no actor, no count.
-- Every other consequential staff action in this schema is attributed
-- (account_settings.role_updated_by, volunteer_signups.cancelled_by/_reason),
-- so this was the odd one out.
--
-- The export route treats a failed insert here as fatal and refuses to serve
-- the CSV. That is deliberate: an audit trail that can be skipped by waiting
-- for a transient database error is not an audit trail.
--
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new

CREATE TABLE IF NOT EXISTS public.contact_exports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SET NULL, not CASCADE: a departing coach's login being deleted must not
  -- delete the record that they exported the roster. Same reasoning as
  -- volunteer_signups.cancelled_by (20260901_volunteer_staff_cancellation.sql)
  -- and account_settings.role_updated_by (20260829_roles_and_nonathlete_profiles.sql).
  exported_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Denormalized on purpose, and NOT NULL. Because the FK above is SET NULL,
  -- this column is the only thing that still answers "who" after an account
  -- is removed — the exact failure mode the cancellation migration called out
  -- when it warned against using a SET NULL column as a discriminator.
  exported_by_email text NOT NULL,
  exported_at       timestamptz NOT NULL DEFAULT now(),
  -- How many contacts the file contained, and which season it covered, so a
  -- review can spot an export that pulled far more than it should have.
  contact_count     integer NOT NULL,
  membership_season text
);

CREATE INDEX IF NOT EXISTS contact_exports_exported_at_idx
  ON public.contact_exports (exported_at DESC);

ALTER TABLE public.contact_exports ENABLE ROW LEVEL SECURITY;

-- Read: board and above only. A coach can trigger an export but cannot review
-- the log of them — reviewing your own audit trail defeats the point, and
-- board+ already has the equivalent read on account_settings
-- (20260901_policy_roles_authenticated.sql).
DROP POLICY IF EXISTS "Board and above read contact exports" ON public.contact_exports;
CREATE POLICY "Board and above read contact exports" ON public.contact_exports
  FOR SELECT
  TO authenticated
  USING (public.has_role_at_least('board'));

-- No INSERT/UPDATE/DELETE policy, deliberately. The only writer is the export
-- route's service-role client, which holds BYPASSRLS — same shape as
-- observation_requests. With no policy, nobody can forge, amend or erase an
-- entry over /rest/v1, which is what makes the log worth having.

-- This project's default privileges grant table rights directly to anon and
-- authenticated, so naming the roles is required — REVOKE FROM PUBLIC alone
-- is a no-op here. See this folder's README, "REVOKE FROM PUBLIC does not
-- work on this project". RLS already denies anon (has_role_at_least is false
-- for an anonymous request), so this is defense in depth, not the only gate.
REVOKE ALL ON TABLE public.contact_exports FROM PUBLIC;
REVOKE ALL ON TABLE public.contact_exports FROM anon;
GRANT SELECT ON TABLE public.contact_exports TO authenticated;

-- ---------------------------------------------------------------------------
-- Post-apply verification — run these, do not assume
-- ---------------------------------------------------------------------------
-- 1. Table exists and is empty; RLS enabled:
--    SELECT relrowsecurity FROM pg_class WHERE oid = 'public.contact_exports'::regclass;  -- true
-- 2. Exactly one policy, roles = {authenticated}:
--    SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'contact_exports';
-- 3. Grants per role — check anon AND authenticated separately, per the
--    README's standing lesson that REVOKE reports success when it removes
--    nothing:
--    SELECT has_table_privilege('anon', 'public.contact_exports', 'SELECT');          -- false
--    SELECT has_table_privilege('authenticated', 'public.contact_exports', 'SELECT'); -- true
--    SELECT has_table_privilege('anon', 'public.contact_exports', 'INSERT');          -- false
--    SELECT has_table_privilege('authenticated', 'public.contact_exports', 'INSERT'); -- false
-- 4. Behavioural: a coach-role session SELECTing this table gets zero rows
--    (policy denies), while a board session sees the entries.
-- 5. End to end: download the CSV as a coach, then confirm exactly one new row
--    whose contact_count matches the file's data-row count.
-- 6. get_advisors: no new findings beyond the accepted baseline.

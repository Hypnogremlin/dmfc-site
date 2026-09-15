-- Same-day correction to 20260914_contact_export_audit.sql, which is already
-- applied and therefore must not be edited or re-run.
--
-- That file revoked table privileges FROM PUBLIC and FROM anon, then granted
-- SELECT to authenticated — and never revoked from `authenticated`. Because
-- this project's default privileges grant table rights *directly* to each
-- role rather than through PUBLIC (README: "REVOKE FROM PUBLIC does not work
-- on this project"), `authenticated` kept the INSERT/UPDATE/DELETE it was
-- granted at CREATE TABLE time. Confirmed live immediately after applying:
--
--   has_table_privilege('authenticated','public.contact_exports','INSERT') -- true
--   has_table_privilege('authenticated','public.contact_exports','DELETE') -- true
--
-- Not a live hole: contact_exports has no INSERT/UPDATE/DELETE policy, so RLS
-- denies all three regardless of the grant. But the whole value of this table
-- is that entries cannot be forged, amended or erased by the people it
-- records, and resting that entirely on "we never add a write policy" is a
-- thinner guarantee than it should be. The grant layer should deny it too.
--
-- This is the same mistake, in its table form, that
-- 20260823_volunteer_revoke_anon_function_execute.sql corrected for
-- functions — and it is the README's standing lesson that REVOKE reports
-- success when it removes nothing. It was caught only because post-apply
-- verification checked each role and privilege separately instead of
-- trusting the statement's exit status.
--
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new

REVOKE ALL ON TABLE public.contact_exports FROM authenticated;
GRANT SELECT ON TABLE public.contact_exports TO authenticated;

-- service_role is untouched — it holds the INSERT the export route needs and
-- carries BYPASSRLS, which is why the route can write a row that no end-user
-- role can write, read back, or remove.

-- ---------------------------------------------------------------------------
-- Post-apply verification — run these, do not assume
-- ---------------------------------------------------------------------------
--   SELECT has_table_privilege('authenticated','public.contact_exports','SELECT'); -- true
--   SELECT has_table_privilege('authenticated','public.contact_exports','INSERT'); -- false
--   SELECT has_table_privilege('authenticated','public.contact_exports','UPDATE'); -- false
--   SELECT has_table_privilege('authenticated','public.contact_exports','DELETE'); -- false
--   SELECT has_table_privilege('anon','public.contact_exports','SELECT');          -- false
--   SELECT has_table_privilege('service_role','public.contact_exports','INSERT');  -- true

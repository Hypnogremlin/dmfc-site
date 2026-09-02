-- Correction found during post-apply verification of
-- 20260820_volunteer_signups.sql (2026-08-23): `claim_volunteer_slot`,
-- `cancel_volunteer_signup`, and `slot_fill_counts` were all callable by the
-- `anon` role immediately after their own `REVOKE ALL ... FROM PUBLIC`
-- statements ran, verified via `has_function_privilege('anon', ..., 'EXECUTE')`
-- returning true and confirmed in `pg_proc.proacl`.
--
-- Root cause: this project's public-schema default privileges grant EXECUTE
-- on every new function directly to `anon`, `authenticated`, and
-- `service_role` at creation time —
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--     GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
-- — confirmed live via `pg_default_acl`. That grant is made directly to each
-- role, not inherited through the `PUBLIC` pseudo-role, so `REVOKE ALL ...
-- FROM PUBLIC` — the pattern used throughout M1, M2, and M3's own migration
-- files — never touches it. This corrects the documented lesson in
-- supabase/migrations/README.md, which had it backwards: see that file for
-- the corrected guidance going forward.
--
-- STATUS: APPLIED to live 2026-08-23 via the Supabase MCP (`apply_migration`,
-- recorded in the remote ledger as `volunteer_revoke_anon_function_execute`).
-- Verified post-apply: `has_function_privilege('anon', ..., 'EXECUTE')` is
-- now false for all three functions; `authenticated` unaffected (still true,
-- as intended — these are member-facing RPCs).
--
-- Idempotent: REVOKE on a privilege a role doesn't hold is a no-op, not an
-- error, so re-running this file is safe.
REVOKE EXECUTE ON FUNCTION public.claim_volunteer_slot(uuid, uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_volunteer_signup(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.slot_fill_counts(uuid) FROM anon;

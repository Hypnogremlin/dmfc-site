-- Defense in depth — add the missing `TO authenticated` clause to the five
-- remaining `public`-role policies on public.account_settings and
-- public.profiles.
--
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new
--
-- STATUS: APPLIED 2026-09-01 via the Supabase MCP (ledger: policy_roles_authenticated).
-- All five policies verified roles = {authenticated}; the standing member self-update
-- regression check was re-run from an impersonated session. DO NOT RE-RUN.
--
-- ── What this is, stated honestly ─────────────────────────────────────────
-- This is NOT an open hole, and this file must not be read as closing one.
--
-- 20260823_volunteer_events_restrict_anon.sql swept `events` and
-- `volunteer_slots` for the same defect and found a real one: two policies
-- there granted SELECT on `published = true` with no role check whatsoever,
-- so published rows were genuinely readable by `anon` over /rest/v1. Nothing
-- of that kind exists here. Every one of the five policies below gates on
-- `auth.uid()` or on `public.has_role_at_least()`, and both are NULL/false
-- for an anonymous PostgREST request:
--
--   * "Users read own account settings" / "Users update own account settings"
--     compare `(select auth.uid()) = id`. `auth.uid()` is NULL for `anon`,
--     and `NULL = id` is NULL, never true. No row matches.
--   * "Board and above read all account settings" / "Admins update any
--     account settings" call `has_role_at_least()`, which resolves the
--     caller's role by reading account_settings by `auth.uid()` — a NULL
--     lookup for `anon`, so it returns false.
--   * "Owners manage their members" on profiles compares
--     `(select auth.uid()) = account_owner_id`. Same NULL comparison.
--
-- Verified live 2026-09-01 against pg_policies before writing this file:
-- all five show `roles = {public}`, with exactly the predicates reproduced
-- below. `anon` reads nothing through any of them today.
--
-- ── So why write it ───────────────────────────────────────────────────────
-- Two reasons, both about the next person rather than about today:
--
--   1. It stops the role restriction from depending on the correctness of
--      every predicate. Right now `anon` is excluded as a *consequence* of
--      each expression happening to be false; with `TO authenticated` it is
--      excluded by the policy's own role list, before the predicate is ever
--      evaluated. A future edit that loosens one of these expressions — the
--      way M2's `published = true` was loosened on `events` — then cannot
--      accidentally hand it to `anon`.
--   2. Consistency. After 20260823, all 9 `events`/`volunteer_slots`
--      policies and both `volunteer_signups` policies read
--      `roles = {authenticated}`. These five were the only `{public}`
--      stragglers left in this feature's blast radius, and their being the
--      odd ones out costs every reviewer the same half hour of re-deriving
--      that they are, in fact, fine.
--
-- ── Scope: the ONLY delta is the TO clause ────────────────────────────────
-- No table, column, data, index, grant, trigger or predicate change. Each
-- policy below is dropped and re-created with its USING / WITH CHECK
-- expression reproduced from the LIVE catalog (pg_policies.qual /
-- .with_check as of 2026-09-01), not from the migration files — the repo has
-- already been caught drifting from live once on this feature (see the
-- 20260820_volunteer_signups.sql row in supabase/migrations/README.md, where
-- the repo copy turned out to be an older draft than what was applied). In
-- this case the two sources happened to agree, but the catalog is what was
-- used. `(select auth.uid())` and `public.has_role_at_least('x')` re-render
-- as `( SELECT auth.uid() AS uid)` and `has_role_at_least('x'::account_role)`
-- respectively — identical parse trees, which is why the 08-23 file's
-- policies still match live byte-for-byte today.
--
-- Provenance note: the four account_settings policies are from
-- 20260727_volunteer_foundations.sql Part 6. "Owners manage their members" on
-- profiles is NOT from that file — it originates in
-- 20260630_family_accounts.sql and was last re-created by
-- 20260704_membership_hardening.sql Part 1 (the initplan `(select auth.uid())`
-- rewrite). Both are applied; neither is edited here, per this folder's
-- new-dated-file rule.
--
-- Ownership is not an obstacle. All five policies sit on tables in `public`
-- owned by `postgres` (verified via pg_class.relowner), so DROP POLICY works
-- normally. The `pg_trigger`-guarded conditional CREATE in
-- 20260727_volunteer_foundations.sql Part 3 exists because DROP TRIGGER needs
-- ownership of `auth.users`, which postgres does not have — that constraint
-- does not apply to anything in this file.
--
-- `service_role` is unaffected: it holds BYPASSRLS (verified via
-- pg_roles.rolbypassrls), so RLS policies never apply to it at all and
-- narrowing a policy's role list cannot break a service-role code path.
-- The only clients this can affect are `anon` and `authenticated`.
--
-- ── Why `authenticated` is the right role for all five ────────────────────
-- Checked read-only against src/ on 2026-09-01. Every code path that touches
-- these two tables is one of:
--
--   * A session client (`createSessionClient`, src/lib/supabase-server.ts)
--     used only under /member — src/app/member/page.tsx,
--     member/actions.ts, member/enroll/**, member/volunteer/**,
--     member/staff/** and src/lib/roles.ts. Every one of those either
--     redirects on a missing session or is behind src/proxy.ts's
--     /member gate, so the request always carries a JWT and runs as
--     `authenticated`. src/components/Header.tsx renders on public pages but
--     calls only `supabase.auth.getUser()`; it never touches either table.
--   * A service client (`createServiceClient`, src/lib/supabase.ts) — the
--     cron jobs in src/lib/cron/** and src/app/observe/actions.ts. Those run
--     as `service_role`, which bypasses RLS entirely (see above).
--   * A SECURITY DEFINER RPC (admin_account_list, event_roster,
--     staff_member_directory, and the pending create_guardian_profile),
--     which executes as `postgres` and is likewise not subject to these
--     policies.
--
-- Signup is the one path worth naming explicitly, because it is the obvious
-- candidate for an anon-role write: it is NOT affected. An account_settings
-- row is created by the `handle_new_user_account_settings()` trigger on
-- auth.users (20260727 Part 3), which is SECURITY DEFINER and runs as the
-- table owner, and account_settings has no INSERT policy at all — the insert
-- was never going through RLS.
--
-- No unauthenticated page reads either table. No `anon` path was found that
-- these policies currently serve.
--
-- ── Post-apply verification ───────────────────────────────────────────────
-- 1. Catalog check — all five must come back `{authenticated}`, and the
--    query must return exactly 5 rows:
--
--      SELECT tablename, policyname, cmd, roles::text, qual, with_check
--      FROM pg_policies
--      WHERE schemaname = 'public'
--        AND tablename IN ('account_settings', 'profiles')
--      ORDER BY tablename, policyname;
--
-- 2. Nothing left behind — this must return zero rows for these two tables:
--
--      SELECT tablename, policyname FROM pg_policies
--      WHERE schemaname = 'public' AND roles::text = '{public}'
--        AND tablename IN ('account_settings', 'profiles');
--
--    (It will still return the three sibling owner-scoped policies on
--    emergency_contacts, member_medical and member_waivers, which are
--    deliberately NOT in this file — see the note at the bottom.)
--
-- 3. Predicates unchanged — compare the `qual`/`with_check` columns from
--    step 1 against these, which are what live showed before this file:
--
--      account_settings | Admins update any account settings        | UPDATE
--        qual/check: has_role_at_least('admin'::account_role)
--      account_settings | Board and above read all account settings | SELECT
--        qual:       has_role_at_least('board'::account_role)
--      account_settings | Users read own account settings           | SELECT
--        qual:       (( SELECT auth.uid() AS uid) = id)
--      account_settings | Users update own account settings         | UPDATE
--        qual/check: (( SELECT auth.uid() AS uid) = id)
--      profiles         | Owners manage their members               | ALL
--        qual/check: (( SELECT auth.uid() AS uid) = account_owner_id)
--
-- 4. FUNCTIONAL CHECK — an ordinary member can still read and update their
--    own account_settings row. Do this from a real signed-in session in the
--    app, not from the SQL Editor. Load /member (which reads
--    account_settings.volunteer_last_seen_at) and then /member/volunteer,
--    and confirm the page renders and the "new since your last visit"
--    marking behaves. Also load /member/staff/roles as the admin and confirm
--    the account list and role picker still work (that exercises the two
--    board/admin policies).
--
-- ── STANDING REGRESSION CHECK — re-run this one ───────────────────────────
-- Per supabase/migrations/README.md and the STATUS headers on
-- 20260829_roles_and_nonathlete_profiles.sql and
-- 20260830_roles_hardening_followup.sql: account_settings carries a trigger
-- that fires on every member's own row on every visit to /member/volunteer,
-- via markVolunteerSeen() in src/app/member/volunteer/actions.ts. That call
-- DISCARDS ITS OWN ERRORS, so a break there is silent and would affect every
-- account (489 at last count) with nothing surfacing in the UI.
--
-- After applying this file, confirm that an ordinary member's self-update of
-- `volunteer_last_seen_at` still SUCCEEDS, from a real member session —
-- sign in as a non-staff account, visit /member/volunteer, then verify the
-- row actually moved:
--
--      SELECT id, volunteer_last_seen_at FROM public.account_settings
--      WHERE id = '<that member''s auth.users id>';
--
-- Do NOT run this check from the SQL Editor. There `auth.uid()` is NULL, the
-- session is `postgres` rather than `authenticated`, and the whole guarded
-- path is skipped — the check passes vacuously and proves nothing. This is
-- the exact trap recorded against the 08-29 and 08-30 migrations.
--
-- (This file changes only a role list, so the trigger itself is untouched
-- and the risk here is lower than it was for those two. Re-run it anyway:
-- "Users update own account settings" is the policy markVolunteerSeen()
-- depends on, and it is one of the five being dropped and re-created.)
--
-- Idempotent: every statement is DROP POLICY IF EXISTS followed by CREATE
-- POLICY, so re-running this file is safe. Note the folder's standing
-- caveat, though — idempotent here means "won't crash," not "won't change
-- anything." If any of these five policies is ever edited again, a later
-- re-run of this file would silently roll that edit back.


-- ── public.account_settings ───────────────────────────────────────────────

DROP POLICY IF EXISTS "Users read own account settings" ON public.account_settings;
CREATE POLICY "Users read own account settings" ON public.account_settings
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Board and above read all account settings" ON public.account_settings;
CREATE POLICY "Board and above read all account settings" ON public.account_settings
  FOR SELECT
  TO authenticated
  USING (public.has_role_at_least('board'));

DROP POLICY IF EXISTS "Users update own account settings" ON public.account_settings;
CREATE POLICY "Users update own account settings" ON public.account_settings
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Admins update any account settings" ON public.account_settings;
CREATE POLICY "Admins update any account settings" ON public.account_settings
  FOR UPDATE
  TO authenticated
  USING (public.has_role_at_least('admin'))
  WITH CHECK (public.has_role_at_least('admin'));


-- ── public.profiles ───────────────────────────────────────────────────────
-- FOR ALL, so this single policy governs member SELECT/INSERT/UPDATE/DELETE
-- of their own household's rows: the enrollment wizard
-- (src/app/member/actions.ts), the dashboard read (src/app/member/page.tsx),
-- and D14's self-serve volunteer-profile insert
-- (src/app/member/enroll/volunteer/actions.ts). All three run from a
-- signed-in session behind src/proxy.ts's /member gate.

DROP POLICY IF EXISTS "Owners manage their members" ON public.profiles;
CREATE POLICY "Owners manage their members" ON public.profiles
  FOR ALL
  TO authenticated
  USING ((select auth.uid()) = account_owner_id)
  WITH CHECK ((select auth.uid()) = account_owner_id);


-- ── Deliberately NOT in this file ─────────────────────────────────────────
-- The 2026-09-01 sweep of pg_policies found three more `{public}` policies in
-- the public schema, all from 20260704_membership_hardening.sql Part 1:
--
--   emergency_contacts | "Owners manage member emergency contacts" | ALL
--   member_medical     | "Owners manage member medical info"       | ALL
--   member_waivers     | "Owners manage member waivers"            | ALL
--
-- All three are the same owner-scoped shape as "Owners manage their members"
-- above — `EXISTS (SELECT 1 FROM profiles p WHERE p.id = profile_id AND
-- p.account_owner_id = (select auth.uid()))` — and are equally unreachable by
-- `anon` for the same NULL-comparison reason. They belong to the Phase 2
-- membership/enrollment feature rather than to the volunteer system, so they
-- are left for the owner to decide on rather than swept in here. They are the
-- natural contents of a follow-up file if he wants the whole public schema
-- consistent in one pass.
--
-- public.observation_requests (Phase 1) is deliberately untouched and needs
-- nothing: RLS is enabled on it with ZERO policies, so no role reaches it
-- through RLS at all. Its only writer is src/app/observe/actions.ts via the
-- service client, which bypasses RLS.

-- Volunteer system, M3.5 — roles and non-athlete accounts.
--
-- Two features, one mechanism. Roles attach to a LOGIN (auth.users), never to a
-- person, because one login owns many profiles (VOLUNTEERS.md D4). This file
-- adds (a) the ability to grant coach/board from inside the app, and (b) a third
-- person_type so a board member or alum who does not fence can exist as a named
-- human at all.
--
-- Until now account_settings.role had NO write path anywhere in the codebase —
-- the owner is the only admin, granted by hand in SQL. Every role-gated surface
-- built in M2/M4 is therefore reachable by exactly one person.
--
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new
--
-- STATUS: APPLIED to live 2026-08-29 via the Supabase MCP (`apply_migration`,
-- recorded in the remote ledger as `roles_and_nonathlete_profiles`).
--
-- Verified post-apply, in full:
--   * profiles_person_type_check now accepts athlete|guardian|volunteer;
--     profiles_athlete_required_fields unchanged.
--   * account_settings.role_updated_at / role_updated_by present; 0 rows stamped
--     (no role has been changed yet), so the hand-granted admin still reads as
--     un-attributed, as intended.
--   * Three triggers on the two tables: account_settings_role_guard,
--     profiles_person_type_guard, profiles_updated_at.
--   * Grants, checked per role: admin_account_list anon=false/authenticated=true;
--     prevent_person_type_change anon=false/authenticated=false;
--     prevent_self_role_change anon=false/authenticated=false;
--     has_role_at_least authenticated=true (correctly NOT revoked).
--   * Row counts unchanged: 478 logins, 478 account_settings, 58 profiles, all
--     58 still person_type='athlete', exactly 1 admin.
--   * Six behavioural tests run inside a rolled-back transaction against real
--     rows, impersonating a member and then the admin via request.jwt.claims:
--       1. member self-update (the markVolunteerSeen shape) SUCCEEDS  ← the
--          regression this file's Part 4 most risked breaking
--       2. member self-promotion blocked: 'role may only be changed by an admin'
--       3. member person_type change blocked: 'person_type may not be changed'
--       4. admin grants coach: succeeds AND stamps role_updated_by = the acting
--          admin, role_updated_at non-null
--       5. admin granting 'admin' via the API blocked: 'admin may only be
--          granted outside the application'
--       6. admin self-demotion blocked: 'an account may not change its own role'
--   * admin_account_list(): a member calling it raises 'not authorized'; the
--     admin sees 47 accounts by default and 478 with p_with_people_only=false;
--     `people` carries the full CandidateProfile field set.
--   * get_advisors: exactly ONE new finding, the expected
--     authenticated_security_definer notice for admin_account_list — same shape
--     already accepted for claim_volunteer_slot, cancel_volunteer_signup,
--     slot_fill_counts and event_roster. No anon finding. Everything else is the
--     pre-existing baseline.
--
-- Ordering: this file is INDEPENDENT of 20260829_volunteer_staff_roster.sql
-- (same date prefix, written the same day by concurrent work). They share no
-- tables, functions, or triggers; either order replays cleanly.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS before ADD,
-- CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS before CREATE. Re-running
-- the whole file is safe. Note both triggers here are on public.profiles /
-- public.account_settings, which `postgres` owns — unlike the auth.users trigger
-- in M1 Part 3, DROP TRIGGER is permitted, so the house pattern applies.
--
-- REVOKE pattern per supabase/migrations/README.md's corrected lesson: REVOKE
-- FROM PUBLIC alone does nothing on this project (default privileges grant
-- EXECUTE directly to anon/authenticated at creation time) — anon must be named
-- explicitly, and authenticated too for trigger functions.


-- ---------------------------------------------------------------------------
-- Part 1 — grant attribution on account_settings
-- ---------------------------------------------------------------------------
-- Not a grants-history table: D5's "a permissions join table is over-engineering
-- for a club this size" applies here too. But board turnover is real and "who
-- made this person a coach, and when" gets asked out loud.

ALTER TABLE public.account_settings
  ADD COLUMN IF NOT EXISTS role_updated_at timestamptz,
  -- ON DELETE SET NULL is load-bearing. CASCADE — the reflexive choice — would
  -- mean deleting one admin's login deletes the account_settings ROW of every
  -- account they ever granted a role to, silently dropping those accounts'
  -- roles along with it. Losing the attribution is acceptable; losing the role
  -- is not.
  ADD COLUMN IF NOT EXISTS role_updated_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

-- No backfill. The existing hand-granted admin correctly reads as
-- un-attributed, which is truthful: it was granted out of band.


-- ---------------------------------------------------------------------------
-- Part 2 — widen person_type to include 'volunteer'
-- ---------------------------------------------------------------------------
-- D14. The club counts board service and coaching AS volunteering — those
-- people simply volunteer continuously rather than against a specific event —
-- so 'volunteer' is accurate and was the value D2 originally reserved.
--
-- profiles_athlete_required_fields is deliberately NOT touched: it binds
-- `person_type <> 'athlete'`, so athlete validation stays exactly as strict as
-- it is today and a lean volunteer row is already legal the moment this CHECK
-- widens. No backfill, no data change.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_person_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_person_type_check
  CHECK (person_type IN ('athlete', 'guardian', 'volunteer'));


-- ---------------------------------------------------------------------------
-- Part 3 — person_type immutability trigger (owed since M1)
-- ---------------------------------------------------------------------------
-- M1's review deferred this explicitly: "add it when guardian rows become
-- reachable." They became reachable in M3, and M3.5 adds the FIRST
-- client-supplied person_type write in the codebase (the self-serve volunteer
-- signup). It is now due.
--
-- The hole it closes: the profiles policy is an unrestricted
-- FOR ALL USING (account_owner_id = auth.uid()) (20260704_membership_hardening),
-- so a member can PATCH /rest/v1/profiles flipping their own athlete to
-- 'volunteer' and then null out birthday and address. The conditional CHECK
-- cannot stop that — it stops binding the moment the type changes.
--
-- Gated on auth.uid() IS NOT NULL, exactly like prevent_self_role_change():
-- a JWT-bearing member is blocked; the SQL editor, service role, and migrations
-- carry no JWT and stay able to repair a row by hand. No admin exemption is
-- needed — no in-app code path ever changes person_type, so the correct in-app
-- answer is always "no."
--
-- Consequence, accepted: a supporter who later takes up fencing ADDS an athlete
-- profile rather than converting the existing row. That matches the account
-- model already in place — one login, many people.

CREATE OR REPLACE FUNCTION public.prevent_person_type_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.person_type IS DISTINCT FROM OLD.person_type
     AND (select auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'person_type may not be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_person_type_guard ON public.profiles;
CREATE TRIGGER profiles_person_type_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_person_type_change();

REVOKE ALL     ON FUNCTION public.prevent_person_type_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_person_type_change() FROM anon, authenticated;


-- ---------------------------------------------------------------------------
-- Part 4 — harden prevent_self_role_change() and stamp attribution
-- ---------------------------------------------------------------------------
-- Pushes two of D13's rules below the application layer, so a hand-crafted REST
-- call from a compromised admin session cannot bypass them, and stamps the
-- attribution columns where they cannot be forged.
--
-- WHY THE STAMP LIVES HERE AND NOT IN THE SERVER ACTION: account_settings' RLS
-- lets a member UPDATE their own row (that is how volunteer_emails_enabled and
-- volunteer_last_seen_at are written). An action-set role_updated_by would
-- therefore be forgeable by any member on their own row. Setting it in the
-- trigger, from auth.uid(), makes it unforgeable by construction.
--
-- ⚠️  CORRECTION (2026-08-30): that last sentence was WRONG, and an independent
--     validation pass caught it the next day. This trigger WRITES those columns
--     when the role changes; it does NOT PROTECT them when the role doesn't.
--     A member could therefore PATCH their own row setting role_updated_by to
--     any uuid — the guarded block is skipped because the role is unchanged, so
--     the write lands. No privilege gained, but a false "granted by" line could
--     be planted on /member/staff/roles. Closed by
--     20260830_roles_hardening_followup.sql Part 1, which adds an ELSIF pinning
--     both columns back to their old values on any end-user update that does
--     not change the role. Statements below are left as originally applied.
--
-- ⚠️  EVERY clause below MUST stay nested inside the
--     `NEW.role IS DISTINCT FROM OLD.role` guard.
--     markVolunteerSeen() (src/app/member/volunteer/actions.ts) updates every
--     member's own account_settings row on every visit to the volunteer list.
--     A self-change check hoisted above that guard would raise for all ~478
--     accounts and break the feature's most-used page — silently, since that
--     call deliberately discards its error.
--
-- The auth.uid() IS NULL path is untouched: the SQL-editor bootstrap that
-- granted the first admin still works, and is now the ONLY way to grant admin
-- or to recover a locked-out one. See D5's long note on why a
-- current_setting('role') comparison must never come back here.

CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND (select auth.uid()) IS NOT NULL THEN

    -- Unchanged from the original: only an admin may change any role at all.
    IF NOT public.has_role_at_least('admin') THEN
      RAISE EXCEPTION 'role may only be changed by an admin';
    END IF;

    -- D13: admin is granted by hand in SQL only, where auth.uid() is NULL and
    -- this whole block is skipped. An admin promoting someone to admin through
    -- the API is refused here as well as in the server action's allowlist.
    IF NEW.role = 'admin'::public.account_role THEN
      RAISE EXCEPTION 'admin may only be granted outside the application';
    END IF;

    -- D13: single-admin lockout guard. With exactly one admin live, a stray
    -- self-demotion is unrecoverable from inside the app.
    IF NEW.id = (select auth.uid()) THEN
      RAISE EXCEPTION 'an account may not change its own role';
    END IF;

    NEW.role_updated_at := now();
    NEW.role_updated_by := (select auth.uid());

  END IF;
  RETURN NEW;
END;
$$;

-- CREATE OR REPLACE preserves the existing ACL, but the README's lesson is that
-- REVOKE reports success even when it removes nothing — restate rather than
-- assume.
REVOKE ALL     ON FUNCTION public.prevent_self_role_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_self_role_change() FROM anon, authenticated;


-- ---------------------------------------------------------------------------
-- Part 5 — admin_account_list() RPC
-- ---------------------------------------------------------------------------
-- The role picker needs to show WHO is on each account, and for the ~431
-- profile-less logins the email is the only identifier that exists. Neither is
-- reachable from a session client: account_settings has no name or email
-- column, and auth.users is not exposed over REST at all.
--
-- Same shape and same reason as slot_fill_counts() (M3) and event_roster()
-- (M4 partial) — a SECURITY DEFINER function exposing exactly what one screen
-- needs, rather than a blanket read grant on profiles or a denormalized email
-- column on account_settings (which board+ can already read in full, and which
-- would hand every board account all ~478 member email addresses over plain
-- REST).
--
-- `people` is shaped to match CandidateProfile in src/lib/volunteer/candidates.ts
-- EXACTLY. That field list is the contract: this RPC exists to feed
-- candidatesFor(), which is what makes a phantom guardian like Patrick appear
-- next to his son Michael, and what dedupes an adult who both fences and is
-- listed as guardian on three children down to one entry instead of four.
-- Keeping the shapes identical is what stops a second resolution path growing.

CREATE OR REPLACE FUNCTION public.admin_account_list(
  p_query            text    DEFAULT NULL,
  p_with_people_only boolean DEFAULT true,
  p_limit            integer DEFAULT 200
)
RETURNS TABLE (
  account_id            uuid,
  email                 text,
  role                  public.account_role,
  signed_up_at          timestamptz,
  last_sign_in_at       timestamptz,
  role_updated_at       timestamptz,
  role_updated_by_email text,
  profile_count         integer,
  people                jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
BEGIN
  -- The single highest-consequence line in this milestone. Omitting it, or
  -- moving it below any read, exposes every member email address to any
  -- signed-in member over /rest/v1/rpc/. It must stay the first statement.
  IF NOT public.has_role_at_least('admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    a.role,
    u.created_at,
    u.last_sign_in_at,
    a.role_updated_at,
    granter.email::text,
    COALESCE(pr.cnt, 0)::integer,
    COALESCE(pr.people, '[]'::jsonb)
  FROM auth.users u
  -- LEFT, not INNER: an account somehow missing its settings row must still be
  -- visible on the one screen that could reveal the problem, rather than
  -- silently vanishing from it.
  LEFT JOIN public.account_settings a ON a.id = u.id
  LEFT JOIN auth.users granter ON granter.id = a.role_updated_by
  LEFT JOIN LATERAL (
    SELECT
      count(*)::integer AS cnt,
      jsonb_agg(
        jsonb_build_object(
          'id',                    p.id,
          'person_type',           p.person_type,
          'first_name',            p.first_name,
          'last_name',             p.last_name,
          'birthday',              p.birthday,
          'contact_phone',         p.contact_phone,
          'guardian_first_name',   p.guardian_first_name,
          'guardian_last_name',    p.guardian_last_name,
          'guardian_relationship', p.guardian_relationship,
          'guardian_phone',        p.guardian_phone
        )
        ORDER BY p.created_at
      ) AS people
    FROM public.profiles p
    WHERE p.account_owner_id = u.id
  ) pr ON true
  WHERE
    (NOT p_with_people_only OR COALESCE(pr.cnt, 0) > 0)
    AND (
      p_query IS NULL
      OR btrim(p_query) = ''
      OR u.email ILIKE '%' || p_query || '%'
      OR EXISTS (
        SELECT 1
        FROM public.profiles pm
        WHERE pm.account_owner_id = u.id
          AND (
            pm.first_name           ILIKE '%' || p_query || '%'
            OR pm.last_name         ILIKE '%' || p_query || '%'
            -- The guardian_* columns are NOT optional here. A parent on the
            -- board commonly has no profile of their own — they exist only as
            -- phantom data on a child's row — so omitting these makes
            -- searching for them return nothing, defeating the screen.
            OR pm.guardian_first_name ILIKE '%' || p_query || '%'
            OR pm.guardian_last_name  ILIKE '%' || p_query || '%'
          )
      )
    )
  ORDER BY COALESCE(pr.cnt, 0) DESC, u.email
  LIMIT p_limit;
END;
$$;

REVOKE ALL     ON FUNCTION public.admin_account_list(text, boolean, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_account_list(text, boolean, integer) FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_account_list(text, boolean, integer) TO authenticated;

-- Do NOT revoke public.has_role_at_least — it is called inside RLS policies and
-- is evaluated as the querying role. Revoking it turns a member's ordinary
-- SELECT into a permission error instead of an empty result.
-- (supabase/migrations/README.md, final note.)


-- ---------------------------------------------------------------------------
-- Post-apply verification — run these, do not assume
-- ---------------------------------------------------------------------------
-- 1. Constraint widened, athlete rules untouched:
--    SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid = 'public.profiles'::regclass AND contype = 'c';
--
-- 2. Attribution columns present:
--    SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='account_settings';
--
-- 3. Both triggers present:
--    SELECT c.relname, t.tgname FROM pg_trigger t
--    JOIN pg_class c ON c.oid = t.tgrelid
--    WHERE NOT t.tgisinternal AND c.relname IN ('profiles','account_settings');
--
-- 4. Grants — check EVERY role, not just authenticated. Checking only
--    authenticated is exactly how the M3 anon gap survived to a second file:
--    SELECT
--      has_function_privilege('anon','public.admin_account_list(text,boolean,integer)','EXECUTE')          AS anon_list,          -- expect false
--      has_function_privilege('authenticated','public.admin_account_list(text,boolean,integer)','EXECUTE') AS auth_list,          -- expect true
--      has_function_privilege('anon','public.prevent_person_type_change()','EXECUTE')                      AS anon_ptype,         -- expect false
--      has_function_privilege('authenticated','public.prevent_person_type_change()','EXECUTE')             AS auth_ptype,         -- expect false
--      has_function_privilege('anon','public.prevent_self_role_change()','EXECUTE')                        AS anon_roleguard,     -- expect false
--      has_function_privilege('authenticated','public.prevent_self_role_change()','EXECUTE')               AS auth_roleguard;     -- expect false
--
-- 5. No data moved:
--    SELECT (SELECT count(*) FROM auth.users)                                  AS logins,    -- expect 478
--           (SELECT count(*) FROM public.profiles)                             AS profiles,  -- expect 58
--           (SELECT count(*) FROM public.profiles WHERE person_type='athlete') AS athletes,  -- expect 58
--           (SELECT count(*) FROM public.account_settings WHERE role='admin')  AS admins;    -- expect 1
--
-- 6. The role guard still lets an ordinary self-update through — this is the
--    markVolunteerSeen() regression check, and it must be run from a real
--    member session, not the SQL editor (auth.uid() is NULL here, which skips
--    the entire guarded block and would pass vacuously).
--
-- 7. get_advisors (security + performance): expect ONE new
--    security_definer/search_path notice for admin_account_list, matching the
--    accepted baseline shape already carried by claim_volunteer_slot,
--    cancel_volunteer_signup, slot_fill_counts, and event_roster. Nothing else.

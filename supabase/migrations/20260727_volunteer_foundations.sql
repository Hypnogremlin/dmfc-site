-- Volunteer system, M1 — foundations: the login-scoped role/settings table
-- and the profiles.person_type split.
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new
--
-- Full design context: VOLUNTEERS.md, sections D2, D4, D5, "Data model", and
-- "Row Level Security". This file implements ONLY M1. The events / slots /
-- signups tables, the claim RPC, and the hours view are M2/M3/M4 and are
-- deliberately NOT here — M1 is the one milestone that touches live member
-- data (relaxing NOT NULLs on `profiles`), so it ships alone and gets its own
-- review pass.
--
-- STATUS: NOT yet applied to live. The owner applies this by hand after
-- review — do not run `supabase db push` and do not apply via MCP.
--
-- Every statement is idempotent (IF [NOT] EXISTS, DROP ... IF EXISTS before
-- CREATE, a DO block for the enum), so re-running this file — or the whole
-- migrations folder from scratch — is safe.

-- ── Part 1 — public.account_role enum ────────────────────────────────────────
-- Four values, in this exact declaration order: Postgres enums compare by
-- declaration position, not alphabetically, so `'board' >= 'coach'` is true
-- and the whole cascade in has_role_at_least() falls out for free. Do not
-- reorder this list without re-checking every >= comparison in this file.
--
-- CREATE TYPE has no IF NOT EXISTS, so idempotency is a catch on the
-- duplicate_object error instead.
DO $$
BEGIN
  CREATE TYPE public.account_role AS ENUM ('member', 'coach', 'board', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Part 2 — public.account_settings: the login-scoped satellite table ──────
-- D4: this table stores facts about the LOGIN, never about a PERSON. A
-- profile is not a login (one login can own several member profiles), so
-- "role" and "which mailbox gets the broadcast" have no home on `profiles`.
-- Because this table collects no human identity, the backfill below is the
-- entire migration of every existing user — nothing is ever asked of anyone.
CREATE TABLE IF NOT EXISTS public.account_settings (
  id                        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role                      public.account_role NOT NULL DEFAULT 'member',
  volunteer_emails_enabled  boolean NOT NULL DEFAULT true,
  unsubscribe_token         uuid NOT NULL DEFAULT gen_random_uuid(),
  volunteer_last_seen_at    timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- The unsubscribe route (D9) looks a row up by token alone, with no login —
-- it must be unique or a token collision could unsubscribe the wrong family.
CREATE UNIQUE INDEX IF NOT EXISTS account_settings_unsubscribe_token_idx
  ON public.account_settings (unsubscribe_token);

-- Backfill every existing login. No identity is collected here — `id` is the
-- only column supplied, everything else takes its default.
INSERT INTO public.account_settings (id)
  SELECT id FROM auth.users
  ON CONFLICT (id) DO NOTHING;

-- ── Part 3 — keep new logins from ever being missing settings ───────────────
-- The backfill above only covers logins that exist today. Every future
-- signup needs the same row created the moment auth.users gains it, so no
-- code path can ever find a user with no account_settings. SECURITY DEFINER
-- is required here: the inserting statement runs as the trigger's owner, not
-- as the (not yet fully provisioned) new user, and it must be able to write
-- regardless of what RLS says about who can INSERT into account_settings
-- (see Part 6 — there is deliberately no member-facing INSERT policy).
CREATE OR REPLACE FUNCTION public.handle_new_user_account_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.account_settings (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_account_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_account_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_account_settings();

-- ── Part 4 — public.has_role_at_least(): the cascade helper ─────────────────
-- The one place role comparisons happen, so every RLS policy and every
-- server-side assertRole() call in src/lib/roles.ts agrees on what "coach or
-- above" means. STABLE (not VOLATILE) because it only reads, which lets
-- Postgres cache the result within a statement. SECURITY DEFINER + empty
-- search_path per the function_search_path_mutable advisor — every reference
-- is schema-qualified so a hijacked search_path can't redirect it.
CREATE OR REPLACE FUNCTION public.has_role_at_least(min_role public.account_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_settings a
    WHERE a.id = (select auth.uid())
      AND a.role >= min_role
  );
$$;

-- ── Part 5 — role immutability trigger ───────────────────────────────────────
-- D5: "role must not be self-writable." RLS's WITH CHECK cannot see OLD, so
-- there is no way to express "you may update your own row, but not the role
-- column" as a USING/WITH CHECK pair alone — RLS is row-level, not
-- column-level. A BEFORE UPDATE trigger closes that gap: it fires on every
-- UPDATE regardless of which policy allowed it, and blocks the write outright
-- if `role` changed and the caller isn't an admin.
--
-- The guard only applies to JWT-bearing end-user sessions: it is gated on
-- `(select auth.uid()) IS NOT NULL`, not on any Postgres role name. Trusted
-- server-side contexts — the SQL Editor, a service-role connection, the
-- Supabase MCP, or this migration itself running by hand — carry no
-- end-user JWT, so auth.uid() is NULL there and the guard is skipped
-- entirely. That is not a weakening: every one of those contexts already
-- owns the table outright (service_role bypasses RLS; the SQL
-- Editor/MCP connect as the `postgres` owner) and could drop this trigger
-- in the same session if it wanted to, so gating on them would only be
-- theater. This is what makes the very first `admin` grant possible, since
-- has_role_at_least('admin') is false for every account until one exists.
--
-- An earlier draft gated on `current_setting('role', true) <> 'service_role'`
-- instead. That was wrong and created a bootstrap deadlock: verified live
-- against project gevdecxvpvopvdjjpaum, the Supabase SQL Editor connects as
-- `postgres` and never issues `SET ROLE`, so the `role` GUC reads back as
-- `'none'` — not `'service_role'` — even though the session has full owner
-- privileges. `'none' <> 'service_role'` is true, so the old condition never
-- exempted the SQL Editor, and with no JWT `has_role_at_least('admin')` is
-- also false there — the trigger would have raised on every attempt to
-- grant the first admin, from any tool available to the owner. Do not
-- reintroduce a `current_setting('role')` string comparison here; test for
-- the presence of an end-user JWT instead.
--
-- A member hitting the REST API always carries a non-null auth.uid(), so
-- they remain blocked from self-promoting unless already admin. An
-- unauthenticated (anon) request has no matching account_settings row to
-- update in the first place — `(select auth.uid()) = id` and
-- has_role_at_least() both fail for anon — so there is no path by which a
-- non-admin end user reaches this trigger with a NULL uid.
CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND (select auth.uid()) IS NOT NULL
     AND NOT public.has_role_at_least('admin') THEN
    RAISE EXCEPTION 'role may only be changed by an admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS account_settings_role_guard ON public.account_settings;
CREATE TRIGGER account_settings_role_guard
  BEFORE UPDATE ON public.account_settings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_change();

-- ── Part 6 — RLS: public.account_settings ────────────────────────────────────
-- Policy shape, per the table in VOLUNTEERS.md "Row Level Security":
--   SELECT — own row; board+ reads all (needed for the staff volunteer UI to
--            show who opted out of email, and eventually a "manage roles"
--            screen for admins).
--   INSERT — none. The only write path is the auth.users trigger above,
--            which runs SECURITY DEFINER and therefore bypasses RLS entirely.
--            A member-facing INSERT policy would let someone create a
--            settings row for an arbitrary id.
--   UPDATE — own row (the role column itself is guarded by the Part 5
--            trigger, not by this policy); admin may update any row.
--   DELETE — none. Rows are deleted only by the auth.users FK cascade when a
--            login is deleted; nothing else should ever remove one.
ALTER TABLE public.account_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own account settings" ON public.account_settings;
CREATE POLICY "Users read own account settings" ON public.account_settings
  FOR SELECT
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Board and above read all account settings" ON public.account_settings;
CREATE POLICY "Board and above read all account settings" ON public.account_settings
  FOR SELECT
  USING (public.has_role_at_least('board'));

DROP POLICY IF EXISTS "Users update own account settings" ON public.account_settings;
CREATE POLICY "Users update own account settings" ON public.account_settings
  FOR UPDATE
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Admins update any account settings" ON public.account_settings;
CREATE POLICY "Admins update any account settings" ON public.account_settings
  FOR UPDATE
  USING (public.has_role_at_least('admin'))
  WITH CHECK (public.has_role_at_least('admin'));

-- ── Part 7 — profiles.person_type: profiles becomes a people table ──────────
-- D2: profiles today holds only athletes. A guardian who volunteers needs a
-- row too (D3), but a guardian record must not be forced through athlete-only
-- validation (date of birth, sex at birth, home address) — that is both
-- friction and a privacy problem for an adult who is only here to work a
-- shift, not to fence.
--
-- DEFAULT 'athlete' IS the backfill: all 45 existing rows are correct the
-- instant this column exists, with no UPDATE statement and no risk to live
-- data.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS person_type text NOT NULL DEFAULT 'athlete';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_person_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_person_type_check
  CHECK (person_type IN ('athlete', 'guardian'));

-- Relax athlete-only NOT NULLs so a lean guardian row is possible.
-- first_name, last_name, contact_email, contact_phone, and account_owner_id
-- stay NOT NULL for every person_type — a volunteer record with no reachable
-- contact is useless regardless of whether they fence. usa_citizen,
-- weapon_classes, citizenship_country, and representing_country already have
-- defaults, so a bare INSERT for a guardian needs no changes there either.
ALTER TABLE public.profiles ALTER COLUMN birthday      DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN sex_at_birth  DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN address_line1 DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN city          DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN state         DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN zip_code      DROP NOT NULL;

-- Athlete validation stays exactly as strict as it was before this migration
-- — the CHECK below re-imposes every constraint that DROP NOT NULL just
-- lifted, but only when person_type = 'athlete'. A guardian row sails past
-- it for free because the OR short-circuits.
--
-- (No edit needed to the existing profiles_sex_at_birth_check constraint
-- from 20260704_membership_hardening.sql: `sex_at_birth IN ('male','female')`
-- evaluates to NULL — not FALSE — for a NULL input, and a NULL CHECK result
-- passes. Dropping NOT NULL above is sufficient on its own.)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_athlete_required_fields;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_athlete_required_fields
  CHECK (
    person_type <> 'athlete' OR (
      birthday      IS NOT NULL AND
      sex_at_birth  IS NOT NULL AND
      address_line1 IS NOT NULL AND
      city          IS NOT NULL AND
      state         IS NOT NULL AND
      zip_code      IS NOT NULL
    )
  );

-- Every query that must exclude guardian rows (the USAF report chief among
-- them — see the "Blast radius" table in VOLUNTEERS.md) filters on this
-- column, so it earns an index rather than relying on enrollment_complete as
-- an incidental filter.
CREATE INDEX IF NOT EXISTS profiles_person_type_idx ON public.profiles (person_type);

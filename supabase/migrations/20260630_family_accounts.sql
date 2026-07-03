-- Phase 2: family accounts — multiple member profiles per login
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new
--
-- Breaks the original "one login = one member" coupling. Until now
-- profiles.id WAS auth.users.id, so each login could own exactly one member.
-- This migration introduces account_owner_id (the login) so one owner can
-- enroll and review several members (a family), and re-points every RLS
-- policy at the owner.
--
-- Every clause is idempotent (IF [NOT] EXISTS / DROP POLICY IF EXISTS), so
-- re-applying is safe. On a from-scratch rebuild this runs AFTER
-- 20260616_phase2_membership.sql and 20260623_waivers_reshape_guardian_usafnum.sql.

-- ── Part 1 — profiles: add the account owner (the login) ─────────────────────
-- Existing rows pre-date families: their id already equals the auth user id, so
-- backfill owner = id. New member rows get a fresh id (Part 2) and inherit the
-- owner from the enrolling login.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE public.profiles SET account_owner_id = id WHERE account_owner_id IS NULL;

ALTER TABLE public.profiles ALTER COLUMN account_owner_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_account_owner_id_idx
  ON public.profiles (account_owner_id);

-- ── Part 2 — decouple profiles.id from auth.users ────────────────────────────
-- A non-owner member (e.g. a child) has no auth.users row, so id can no longer
-- reference auth.users. Keep the UUID primary key; just drop the FK and give new
-- rows their own generated id.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ── Part 3 — photo_release_* waiver columns (parity) ─────────────────────────
-- The app already writes these (added with waiver item 6) but they were never
-- captured in a migration; add them here so the folder is a faithful rebuild.
ALTER TABLE public.member_waivers
  ADD COLUMN IF NOT EXISTS photo_release_agreed    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS photo_release_signature text,
  ADD COLUMN IF NOT EXISTS photo_release_signed_at timestamptz;

-- ── Part 4 — RLS: re-point every policy at the account owner ──────────────────
-- profiles: the old policies checked auth.uid() = id (true only when the login
-- IS the member). Replace with a single owner policy.
DROP POLICY IF EXISTS "Users can view own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owners manage their members"  ON public.profiles;
CREATE POLICY "Owners manage their members" ON public.profiles
  FOR ALL
  USING (auth.uid() = account_owner_id)
  WITH CHECK (auth.uid() = account_owner_id);

-- Child tables: the old policies resolved auth.uid() = (SELECT id FROM profiles
-- WHERE id = profile_id), which breaks once id != auth.uid. Replace with an
-- ownership EXISTS check against the parent profile's account_owner_id.
DROP POLICY IF EXISTS "Users can manage own emergency contacts"    ON public.emergency_contacts;
DROP POLICY IF EXISTS "Owners manage member emergency contacts"    ON public.emergency_contacts;
CREATE POLICY "Owners manage member emergency contacts" ON public.emergency_contacts
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = profile_id AND p.account_owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = profile_id AND p.account_owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can manage own medical info" ON public.member_medical;
DROP POLICY IF EXISTS "Owners manage member medical info" ON public.member_medical;
CREATE POLICY "Owners manage member medical info" ON public.member_medical
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = profile_id AND p.account_owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = profile_id AND p.account_owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can manage own waivers" ON public.member_waivers;
DROP POLICY IF EXISTS "Owners manage member waivers" ON public.member_waivers;
CREATE POLICY "Owners manage member waivers" ON public.member_waivers
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = profile_id AND p.account_owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = profile_id AND p.account_owner_id = auth.uid())
  );

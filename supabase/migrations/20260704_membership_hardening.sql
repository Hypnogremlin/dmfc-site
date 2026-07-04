-- Membership hardening — RLS initplan fix, constraint corrections, and a
-- missing FK.
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new
--
-- STATUS: NOT yet applied to the live project, EXCEPT Part 2 (the
-- observation_requests weapon check) which was already applied manually
-- against live to unblock the current weapon options and is captured here
-- only so this file is a faithful record of the live schema. The owner will
-- apply the rest (Parts 1, 3, 4) directly.
--
-- Every clause is idempotent (DROP POLICY/CONSTRAINT IF EXISTS), so
-- re-applying the whole file is safe.

-- ── Part 1 — RLS: wrap auth.uid() as (select auth.uid()) ─────────────────────
-- Per the Supabase `auth_rls_initplan` advisor, a bare `auth.uid()` inside a
-- USING/WITH CHECK clause is re-evaluated per row; wrapping it in a scalar
-- subquery lets Postgres evaluate it once per statement instead. Same
-- policies/shapes as 20260630_family_accounts.sql, just with the wrapped call.
-- NOT yet applied live.
DROP POLICY IF EXISTS "Owners manage their members" ON public.profiles;
CREATE POLICY "Owners manage their members" ON public.profiles
  FOR ALL
  USING ((select auth.uid()) = account_owner_id)
  WITH CHECK ((select auth.uid()) = account_owner_id);

DROP POLICY IF EXISTS "Owners manage member emergency contacts" ON public.emergency_contacts;
CREATE POLICY "Owners manage member emergency contacts" ON public.emergency_contacts
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = profile_id AND p.account_owner_id = (select auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = profile_id AND p.account_owner_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Owners manage member medical info" ON public.member_medical;
CREATE POLICY "Owners manage member medical info" ON public.member_medical
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = profile_id AND p.account_owner_id = (select auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = profile_id AND p.account_owner_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Owners manage member waivers" ON public.member_waivers;
CREATE POLICY "Owners manage member waivers" ON public.member_waivers
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = profile_id AND p.account_owner_id = (select auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = profile_id AND p.account_owner_id = (select auth.uid()))
  );

-- ── Part 2 — observation_requests.weapon: add the two split foil options ─────
-- The baseline in 20260601023647_create_observation_requests.sql only allows
-- ('foil', 'epee', 'saber'); the RSVP form and live DB have since moved to
-- split foil-youth/foil-adult options like the membership form's
-- weapon_classes. ALREADY APPLIED to live — captured here for parity.
ALTER TABLE public.observation_requests DROP CONSTRAINT IF EXISTS observation_requests_weapon_check;
ALTER TABLE public.observation_requests
  ADD CONSTRAINT observation_requests_weapon_check
  CHECK (weapon IN ('foil-youth', 'foil-adult', 'epee', 'saber'));

-- ── Part 3 — profiles.sex_at_birth: tighten to the two values the app writes ──
-- The original CHECK also allowed 'intersex' and 'prefer_not_to_say', but the
-- enrollment form only ever writes 'male' or 'female' (see SexAtBirth in
-- @/lib/member-types). Tightening closes the gap between what the schema
-- permits and what the app actually validates/sends. NOT yet applied live.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_sex_at_birth_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_sex_at_birth_check
  CHECK (sex_at_birth IN ('male', 'female'));

-- ── Part 4 — observation_requests.converted_to_member_id: add the FK ─────────
-- This column exists to link an observation RSVP to the member profile it
-- converted into, but has never had a foreign key — nothing stops it
-- pointing at a deleted/nonexistent profile. ON DELETE SET NULL so deleting a
-- profile doesn't block or cascade-delete the historical RSVP row. NOT yet
-- applied live.
ALTER TABLE public.observation_requests DROP CONSTRAINT IF EXISTS observation_requests_converted_to_member_id_fkey;
ALTER TABLE public.observation_requests
  ADD CONSTRAINT observation_requests_converted_to_member_id_fkey
  FOREIGN KEY (converted_to_member_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

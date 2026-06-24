-- Phase 2: guardian + USA Fencing fields, and 5-agreement member_waivers reshape
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new
--
-- STATUS: already applied to the live project on 2026-06-23. Re-applying is
-- safe — every clause is IF [NOT] EXISTS. This file exists so the migrations
-- folder is a faithful rebuild source (the change was first run as raw SQL and
-- was not captured here at the time).
--
-- On a from-scratch rebuild this runs AFTER 20260616_phase2_membership.sql,
-- which creates member_waivers with the original 2-agreement columns this
-- migration then replaces.

-- Part 1 — profiles: guardian fields (NULL for adults, set for minors) plus the
--          admin-managed USA Fencing number (set on the backend, never via the
--          enrollment form).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS guardian_first_name   text,
  ADD COLUMN IF NOT EXISTS guardian_last_name    text,
  ADD COLUMN IF NOT EXISTS guardian_relationship text,
  ADD COLUMN IF NOT EXISTS guardian_phone        text,
  ADD COLUMN IF NOT EXISTS usa_fencing_number    text;

-- Part 2 — member_waivers: replace the 2 placeholder agreements (dmfc_rules,
--          usa_fencing) with the 5 real ones. Rules of the Club has two signer
--          triplets (athlete + guardian, for the minor case); the rest have one.
--          *_signature / *_signed_at are nullable; *_agreed booleans default false.
--          Signer is derived from athlete age in the app, so there is no
--          signer_type column. No production data exists, so dropping the old
--          columns is safe.
ALTER TABLE public.member_waivers
  DROP COLUMN IF EXISTS dmfc_rules_agreed,
  DROP COLUMN IF EXISTS dmfc_rules_signature,
  DROP COLUMN IF EXISTS dmfc_rules_signed_at,
  DROP COLUMN IF EXISTS dmfc_rules_signer_type,
  DROP COLUMN IF EXISTS usa_fencing_agreed,
  DROP COLUMN IF EXISTS usa_fencing_signature,
  DROP COLUMN IF EXISTS usa_fencing_signed_at,
  DROP COLUMN IF EXISTS usa_fencing_signer_type,
  ADD COLUMN IF NOT EXISTS rules_club_athlete_agreed     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rules_club_athlete_signature  text,
  ADD COLUMN IF NOT EXISTS rules_club_athlete_signed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS rules_club_guardian_agreed    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rules_club_guardian_signature text,
  ADD COLUMN IF NOT EXISTS rules_club_guardian_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS athlete_coc_agreed            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS athlete_coc_signature         text,
  ADD COLUMN IF NOT EXISTS athlete_coc_signed_at         timestamptz,
  ADD COLUMN IF NOT EXISTS parent_coc_agreed             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_coc_signature          text,
  ADD COLUMN IF NOT EXISTS parent_coc_signed_at          timestamptz,
  ADD COLUMN IF NOT EXISTS individual_waiver_agreed      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS individual_waiver_signature   text,
  ADD COLUMN IF NOT EXISTS individual_waiver_signed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS maapp_agreed                  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maapp_signature               text,
  ADD COLUMN IF NOT EXISTS maapp_signed_at               timestamptz;

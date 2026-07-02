-- Phase 2: Photo & Video Release — waiver item 6
--
-- STATUS: applied to the live project on 2026-06-29 via the Supabase MCP
-- (`apply`-style execute_sql) and recorded in supabase_migrations.schema_migrations
-- as version 20260629. Re-applying is safe — every clause is ADD COLUMN IF NOT EXISTS.
--
-- On a from-scratch rebuild this runs AFTER
-- 20260623_waivers_reshape_guardian_usafnum.sql, adding the photo-release signer
-- triplet alongside the five existing agreement triplets on member_waivers.
-- Signer is derived from athlete age in the app (adult athlete signs for self;
-- guardian signs for minors), matching the other waiver columns. *_signature /
-- *_signed_at are nullable; *_agreed defaults false.

ALTER TABLE public.member_waivers
  ADD COLUMN IF NOT EXISTS photo_release_agreed     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS photo_release_signature  text,
  ADD COLUMN IF NOT EXISTS photo_release_signed_at  timestamptz;

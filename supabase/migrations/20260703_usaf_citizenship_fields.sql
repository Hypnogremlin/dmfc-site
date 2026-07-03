-- Phase 2: citizenship + representing-country fields for the USA Fencing bulk
-- upload report
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new
--
-- USAF's Bulk Uploader requires ISO Alpha-2 codes for both the fencer's
-- citizenship and the country they represent (columns K/L of the template).
-- Admin-managed like usa_fencing_number — never set via the enrollment form.
-- Defaults to 'US' so the common case needs no manual admin work; the rare
-- international member gets their codes corrected directly in Supabase.
--
-- Idempotent; safe to re-apply.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS citizenship_country  TEXT NOT NULL DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS representing_country TEXT NOT NULL DEFAULT 'US';

-- Phase 2: weekly USA Fencing membership report — "new member" tracking
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new
--
-- The weekly cron (/api/cron/usaf-report) emails the president a CSV of members
-- newly completed since the last report. usaf_reported_at marks which completed
-- members have already been included, so each member is reported exactly once
-- (the same idea as observation_requests.reminder_sent). NULL = not yet reported.
--
-- Idempotent; safe to re-apply. Order relative to 20260630_family_accounts.sql
-- does not matter (both only ALTER profiles additively).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS usaf_reported_at TIMESTAMPTZ;

-- Partial index over the exact predicate the cron filters on (completed members
-- not yet reported), keeping the weekly scan cheap as the table grows.
CREATE INDEX IF NOT EXISTS profiles_usaf_unreported_idx
  ON public.profiles (enrollment_complete)
  WHERE usaf_reported_at IS NULL;

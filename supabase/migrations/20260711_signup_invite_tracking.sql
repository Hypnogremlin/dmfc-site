-- Phase 2: track whether a post-observation membership signup invite has
-- been sent for a given observation_requests submission.
--
-- Mirrors the existing reminder_sent flag/index pattern from
-- 20260601023647_create_observation_requests.sql. The signupInvite cron
-- pass (src/lib/cron/signupInvite.ts) flips this to true once an invite
-- email has been sent for a submission_id group.
--
-- Idempotent; safe to re-apply.

ALTER TABLE public.observation_requests
  ADD COLUMN IF NOT EXISTS signup_invite_sent boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS observation_requests_signup_invite_idx
  ON public.observation_requests (visit_date)
  WHERE signup_invite_sent = false;

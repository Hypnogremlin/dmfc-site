-- Volunteer system, M4 (partial) — staff roster view. Adds ONE new RPC,
-- event_roster(), so a coach/board viewer can resolve attendee identities
-- for an event's live signups. Nothing else from M4 (attended,
-- credited_hours, the volunteer_hours view, the attendance-confirm UI) is
-- part of this file — see VOLUNTEERS.md's Execution Status for the scope
-- split.
--
-- Why this is needed: `volunteer_signups` already has a "coaches and above
-- read all signups" policy (from 20260820_volunteer_signups.sql), so a coach
-- can see every signup row directly. But `profiles` has no coach-level read
-- policy at all — only "Owners manage their members" (account_owner_id =
-- auth.uid()). A signup's attendee_profile_id therefore can't be resolved to
-- a name via a plain join from the staff session client whenever the
-- attendee belongs to a different household than the viewing coach's own.
-- This mirrors the gap slot_fill_counts() closed for capacity in M3 — same
-- shape, different data: a SECURITY DEFINER function that exposes only what
-- the specific screen needs (here, a name/phone/notes triple per live
-- signup for one event), not a blanket profiles-read grant for coach+.
--
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new
--
-- STATUS: APPLIED to live 2026-08-29 via the Supabase MCP (`apply_migration`,
-- recorded in the remote ledger as `volunteer_staff_roster`). Verified
-- post-apply: has_function_privilege() shows anon_can_execute = false,
-- authenticated_can_execute = true. get_advisors shows no new findings
-- beyond the accepted baseline (the expected authenticated_security_definer
-- note, same shape as claim_volunteer_slot/cancel_volunteer_signup/
-- slot_fill_counts; no anon warning).
--
-- REVOKE pattern per supabase/migrations/README.md's corrected lesson:
-- REVOKE FROM PUBLIC alone does nothing on this project (default privileges
-- grant EXECUTE directly to anon/authenticated at creation time) — anon must
-- be named explicitly.

CREATE OR REPLACE FUNCTION public.event_roster(p_event_id uuid)
RETURNS TABLE (
  slot_id        uuid,
  signup_id      uuid,
  attendee_name  text,
  attendee_phone text,
  notes          text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Unlike slot_fill_counts (which any authenticated caller may use, since
  -- it exposes only a count), this function returns identities, so it must
  -- gate on the role itself rather than relying on the caller not to ask.
  IF NOT public.has_role_at_least('coach') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    sl.id,
    s.id,
    COALESCE(p.first_name || ' ' || p.last_name, s.attendee_name, 'Someone else'),
    p.contact_phone,
    s.notes
  FROM public.volunteer_slots sl
  JOIN public.volunteer_signups s ON s.slot_id = sl.id AND s.cancelled_at IS NULL
  LEFT JOIN public.profiles p ON p.id = s.attendee_profile_id
  WHERE sl.event_id = p_event_id
  ORDER BY sl.sort_order, s.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.event_roster(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.event_roster(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.event_roster(uuid) TO authenticated;

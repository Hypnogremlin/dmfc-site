-- Volunteer system extension — staff member directory. Adds ONE new RPC,
-- staff_member_directory(), so a coach/board/admin viewer can look up any
-- member's contact info, emergency contacts, class enrollment, and medical
-- notes from a single searchable screen.
--
-- Same gap as event_roster() / admin_account_list(): `profiles` carries no
-- coach-level read policy (see 20260829_volunteer_staff_roster.sql's header),
-- so this is another narrow SECURITY DEFINER function exposing exactly the
-- fields the screen needs, rather than a blanket profiles-read grant.
--
-- Deliberately excluded from the return shape, even though they exist on
-- `profiles`: sex_at_birth, gender_identity, usa_citizen, citizenship_country,
-- representing_country, usa_fencing_number, usaf_reported_at. `member_waivers`
-- is not joined at all. None of that is needed to look someone up or reach
-- them in an emergency, and it is either more sensitive than this screen
-- warrants or simply irrelevant to it.
--
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new
--
-- REVOKE pattern per supabase/migrations/README.md: REVOKE FROM PUBLIC alone
-- does nothing on this project — anon must be named explicitly.

CREATE OR REPLACE FUNCTION public.staff_member_directory(
  p_query  text DEFAULT NULL,
  p_weapon text DEFAULT NULL,
  p_season text DEFAULT NULL
)
RETURNS TABLE (
  id                      uuid,
  person_type             text,
  first_name              text,
  last_name               text,
  birthday                date,
  weapon_classes          text[],
  shirt_size              text,
  membership_season       text,
  enrollment_complete     boolean,
  contact_email           text,
  contact_phone           text,
  address_line1           text,
  address_line2           text,
  city                    text,
  state                   text,
  zip_code                text,
  guardian_first_name     text,
  guardian_last_name      text,
  guardian_relationship   text,
  guardian_phone          text,
  medical_conditions      text,
  preferred_medical_system text,
  emergency_contacts      jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Highest-consequence line in this function: it returns identities,
  -- contact info, and medical notes for every member in the club, so it
  -- must gate on the role itself, first, before any read happens.
  IF NOT public.has_role_at_least('coach') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.person_type,
    p.first_name,
    p.last_name,
    p.birthday,
    p.weapon_classes,
    p.shirt_size,
    p.membership_season,
    p.enrollment_complete,
    p.contact_email,
    p.contact_phone,
    p.address_line1,
    p.address_line2,
    p.city,
    p.state,
    p.zip_code,
    p.guardian_first_name,
    p.guardian_last_name,
    p.guardian_relationship,
    p.guardian_phone,
    m.medical_conditions,
    m.preferred_medical_system,
    COALESCE(ec.contacts, '[]'::jsonb)
  FROM public.profiles p
  LEFT JOIN public.member_medical m ON m.profile_id = p.id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'contact_order', e.contact_order,
        'first_name',    e.first_name,
        'last_name',     e.last_name,
        'relationship',  e.relationship,
        'email',         e.email,
        'email_2',       e.email_2,
        'phone',         e.phone,
        'phone_2',       e.phone_2
      )
      ORDER BY e.contact_order
    ) AS contacts
    FROM public.emergency_contacts e
    WHERE e.profile_id = p.id
  ) ec ON true
  WHERE
    (p_weapon IS NULL OR p.weapon_classes @> ARRAY[p_weapon])
    AND (p_season IS NULL OR p.membership_season = p_season)
    AND (
      p_query IS NULL
      OR btrim(p_query) = ''
      OR p.first_name          ILIKE '%' || p_query || '%'
      OR p.last_name           ILIKE '%' || p_query || '%'
      OR p.guardian_first_name ILIKE '%' || p_query || '%'
      OR p.guardian_last_name  ILIKE '%' || p_query || '%'
      OR p.contact_email       ILIKE '%' || p_query || '%'
    )
  ORDER BY p.last_name, p.first_name;
END;
$$;

REVOKE ALL     ON FUNCTION public.staff_member_directory(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.staff_member_directory(text, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.staff_member_directory(text, text, text) TO authenticated;


-- ---------------------------------------------------------------------------
-- Post-apply verification — run these, do not assume
-- ---------------------------------------------------------------------------
-- 1. Grants:
--    SELECT
--      has_function_privilege('anon','public.staff_member_directory(text,text,text)','EXECUTE')          AS anon_dir,  -- expect false
--      has_function_privilege('authenticated','public.staff_member_directory(text,text,text)','EXECUTE') AS auth_dir;  -- expect true
--
-- 2. A member-role session calling staff_member_directory() raises
--    'not authorized'; a coach/board/admin session gets rows back with no
--    sex_at_birth/gender_identity/waiver keys present.
--
-- 3. get_advisors: expect exactly ONE new security_definer/search_path
--    notice for staff_member_directory, same accepted shape as
--    admin_account_list/event_roster/slot_fill_counts/claim_volunteer_slot.

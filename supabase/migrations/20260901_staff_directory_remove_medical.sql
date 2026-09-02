-- Volunteer system follow-up — removes medical_conditions and
-- preferred_medical_system from staff_member_directory()'s return shape.
--
-- Per 20260831_staff_member_directory.sql's own header, this RPC is the
-- club's whole membership roster in one call, gated only on 'coach'+. That
-- is too broad an audience for medical notes without a vetted, secure way
-- to restrict who can see them — we don't have that yet. Pulled here rather
-- than just hidden in the UI, so the data never leaves Postgres for this
-- screen at all. We'll likely bring it back once a narrower channel exists
-- (e.g. gated to board/admin only, or a separate break-glass RPC).
--
-- Supersedes 20260831_staff_member_directory.sql, which is already applied
-- live — per this folder's README, that file must not be edited or re-run.
--
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new

-- Postgres refuses CREATE OR REPLACE when the RETURNS TABLE column set
-- changes ("cannot change return type of existing function") — confirmed
-- live when this file was first applied. DROP FIRST is required here, which
-- also means the function's grants must be re-issued below; CREATE OR
-- REPLACE would have preserved them, DROP does not.
DROP FUNCTION IF EXISTS public.staff_member_directory(text, text, text);

CREATE FUNCTION public.staff_member_directory(
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
  emergency_contacts      jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
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
    COALESCE(ec.contacts, '[]'::jsonb)
  FROM public.profiles p
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

-- DROP FUNCTION wipes prior grants, so these must be reissued — same
-- anon-naming pattern as 20260831_staff_member_directory.sql.
REVOKE ALL     ON FUNCTION public.staff_member_directory(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.staff_member_directory(text, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.staff_member_directory(text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Post-apply verification — run these, do not assume
-- ---------------------------------------------------------------------------
-- 1. A coach/board/admin session calling staff_member_directory() gets rows
--    back with no medical_conditions/preferred_medical_system keys present
--    (and still no sex_at_birth/gender_identity/waiver keys, per the
--    original file).
-- 2. Grants unchanged from 20260831: has_function_privilege('anon', ...)
--    false, has_function_privilege('authenticated', ...) true.
-- 3. get_advisors: no new findings beyond the accepted baseline already
--    noted for this function.

-- M3.5 follow-up — three corrections found by an independent validation pass
-- on 2026-08-30, the day after 20260829_roles_and_nonathlete_profiles.sql was
-- applied. Separate dated file per this folder's convention; the 08-29 file is
-- left as written, with its inaccurate comment annotated to point here.
--
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new
--
-- STATUS: APPLIED to live 2026-08-30 via the Supabase MCP (`apply_migration`,
-- recorded in the remote ledger as `roles_hardening_followup`).
--
-- Verified post-apply, inside a rolled-back transaction impersonating a member
-- and then the admin via request.jwt.claims:
--   A. member self-update of volunteer_last_seen_at (the markVolunteerSeen
--      shape) still SUCCEEDS — the regression this file most risked.
--   B. member PATCHing their own role_updated_by: the UPDATE succeeds and does
--      NOT raise, and the column is unchanged afterwards. Both halves matter —
--      a raise here would have broken /member/volunteer for every account.
--   C. admin grant still stamps role_updated_by = the acting admin.
--   D. admin_account_list('%') returns 0 rows, not 489 — wildcards are literal.
--   E. admin_account_list('gmail') returns 170 rows — ordinary search unaffected.
--   F. Two 'volunteer' inserts for one account: first succeeds, second raises
--      23505 against profiles_one_volunteer_per_account_idx. Athlete rows on the
--      same account are unaffected, confirming the index is partial.
--   G. Grants unchanged: admin_account_list anon=false/authenticated=true;
--      prevent_self_role_change anon=false/authenticated=false.
--   H. Row counts: profiles 58 (unchanged), exactly 1 admin. auth.users is 489,
--      up from 478 the previous day — 11 more automated signups in ~24h, which
--      is the PLAN.md open-risk item, not a consequence of this migration.
--   I. get_advisors: byte-identical to the pre-apply baseline. No new findings.
--
-- Idempotent: CREATE OR REPLACE FUNCTION, CREATE UNIQUE INDEX IF NOT EXISTS.
-- Re-running is safe.


-- ---------------------------------------------------------------------------
-- Part 1 — stop members forging the role attribution columns
-- ---------------------------------------------------------------------------
-- THE BUG: 20260829's Part 4 comment claimed that stamping role_updated_at /
-- role_updated_by inside this trigger made them "unforgeable by construction."
-- That was wrong, and the distinction is worth stating plainly because it is
-- easy to make again:
--
--   * The trigger WRITES those columns when the role changes.  ← what it did
--   * The trigger PROTECTS those columns when it doesn't.      ← what it did NOT
--
-- account_settings' RLS grants every member UPDATE on their OWN ROW, whole,
-- with no column-level restriction (M1 Part 6: `USING (auth.uid() = id)`).
-- Nothing scopes that to volunteer_emails_enabled and volunteer_last_seen_at.
-- So a member could PATCH /rest/v1/account_settings?id=eq.<self> setting
-- role_updated_by to any auth.users id: their role is unchanged, so the guarded
-- block never runs, and the write simply lands.
--
-- No privilege is gained — RLS still pins them to their own row and the role
-- itself is still guarded. The damage is to integrity: /member/staff/roles
-- renders these two columns as "<role> granted by <email> on <date>", so a
-- member could plant a false attribution on the one screen whose entire purpose
-- is answering who granted what.
--
-- THE FIX: an ELSIF that pins both columns back to their old values on any
-- end-user update that does not change the role.
--
-- ⚠️  IT MUST NOT RAISE. Rejecting the write instead of ignoring it would
--     reintroduce exactly the hazard 20260829's Part 4 was written to avoid:
--     markVolunteerSeen() (src/app/member/volunteer/actions.ts) updates every
--     member's own account_settings row on every visit to /member/volunteer.
--     An exception there breaks the feature's busiest page for all 478
--     accounts, silently, because that call discards its own errors. Silently
--     discarding the forged value is the correct behaviour: the write succeeds,
--     the columns simply do not move.
--
-- The auth.uid() IS NULL path stays untouched, so the SQL editor and service
-- role can still correct attribution by hand.

CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND (select auth.uid()) IS NOT NULL THEN

    IF NOT public.has_role_at_least('admin') THEN
      RAISE EXCEPTION 'role may only be changed by an admin';
    END IF;

    -- D13: admin is granted by hand in SQL only, where auth.uid() is NULL and
    -- this whole block is skipped.
    IF NEW.role = 'admin'::public.account_role THEN
      RAISE EXCEPTION 'admin may only be granted outside the application';
    END IF;

    -- D13: single-admin lockout guard.
    IF NEW.id = (select auth.uid()) THEN
      RAISE EXCEPTION 'an account may not change its own role';
    END IF;

    NEW.role_updated_at := now();
    NEW.role_updated_by := (select auth.uid());

  ELSIF (select auth.uid()) IS NOT NULL THEN

    -- Role unchanged, end-user session: attribution is not theirs to write.
    -- Silently pinned, never rejected — see the warning above.
    NEW.role_updated_at := OLD.role_updated_at;
    NEW.role_updated_by := OLD.role_updated_by;

  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL     ON FUNCTION public.prevent_self_role_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_self_role_change() FROM anon, authenticated;


-- ---------------------------------------------------------------------------
-- Part 2 — one supporter profile per login, enforced by the database
-- ---------------------------------------------------------------------------
-- createVolunteerProfile() checks for an existing 'volunteer' row and then
-- inserts. Those are two statements with a gap between them, so two concurrent
-- submissions (a double-click, or a retried request) can both pass the check
-- and both insert.
--
-- The second row is worse than a failed submit: the very lookup that check uses
-- is .maybeSingle(), which errors on "more than one row" — so the account can
-- never again create a profile through that page, nor get a clean explanation
-- of why. The app-level check stays as a courtesy for the ordinary case; this
-- index is what actually makes it true.
--
-- Partial, so it constrains only supporter rows: an account may still hold many
-- athletes and several guardians.
--
-- Safe to add without a cleanup pass: verified 0 rows with
-- person_type = 'volunteer' live at the time of writing.

CREATE UNIQUE INDEX IF NOT EXISTS profiles_one_volunteer_per_account_idx
  ON public.profiles (account_owner_id)
  WHERE person_type = 'volunteer';


-- ---------------------------------------------------------------------------
-- Part 3 — treat search input as literal text, not as a LIKE pattern
-- ---------------------------------------------------------------------------
-- p_query was interpolated straight into `ILIKE '%' || p_query || '%'`. Not an
-- injection risk — it is a plpgsql expression, never dynamic SQL, so the value
-- can only ever be data. But `%` and `_` are LIKE metacharacters, so searching
-- `a_b` also matched `axb`, and a lone `%` matched every account.
--
-- Escaping them (and the escape character itself) makes a search for a literal
-- underscore find a literal underscore. Building the pattern once also removes
-- five copies of the same concatenation.

CREATE OR REPLACE FUNCTION public.admin_account_list(
  p_query            text    DEFAULT NULL,
  p_with_people_only boolean DEFAULT true,
  p_limit            integer DEFAULT 200
)
RETURNS TABLE (
  account_id            uuid,
  email                 text,
  role                  public.account_role,
  signed_up_at          timestamptz,
  last_sign_in_at       timestamptz,
  role_updated_at       timestamptz,
  role_updated_by_email text,
  profile_count         integer,
  people                jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_pattern text;
BEGIN
  -- Must stay the first statement: the only thing between a signed-in member
  -- and every email address in the club.
  IF NOT public.has_role_at_least('admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_pattern := CASE
    WHEN p_query IS NULL OR btrim(p_query) = '' THEN NULL
    ELSE '%' ||
         replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') ||
         '%'
  END;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    a.role,
    u.created_at,
    u.last_sign_in_at,
    a.role_updated_at,
    granter.email::text,
    COALESCE(pr.cnt, 0)::integer,
    COALESCE(pr.people, '[]'::jsonb)
  FROM auth.users u
  -- LEFT, not INNER: an account missing its settings row must stay visible on
  -- the one screen that could reveal the problem.
  LEFT JOIN public.account_settings a ON a.id = u.id
  LEFT JOIN auth.users granter ON granter.id = a.role_updated_by
  LEFT JOIN LATERAL (
    SELECT
      count(*)::integer AS cnt,
      jsonb_agg(
        jsonb_build_object(
          'id',                    p.id,
          'person_type',           p.person_type,
          'first_name',            p.first_name,
          'last_name',             p.last_name,
          'birthday',              p.birthday,
          'contact_phone',         p.contact_phone,
          'guardian_first_name',   p.guardian_first_name,
          'guardian_last_name',    p.guardian_last_name,
          'guardian_relationship', p.guardian_relationship,
          'guardian_phone',        p.guardian_phone
        )
        ORDER BY p.created_at
      ) AS people
    FROM public.profiles p
    WHERE p.account_owner_id = u.id
  ) pr ON true
  WHERE
    (NOT p_with_people_only OR COALESCE(pr.cnt, 0) > 0)
    AND (
      v_pattern IS NULL
      OR u.email ILIKE v_pattern ESCAPE '\'
      OR EXISTS (
        SELECT 1
        FROM public.profiles pm
        WHERE pm.account_owner_id = u.id
          AND (
            pm.first_name             ILIKE v_pattern ESCAPE '\'
            OR pm.last_name           ILIKE v_pattern ESCAPE '\'
            -- Not optional: a board parent commonly has no profile of their own
            -- and exists only as phantom guardian_* data on a child's row, so
            -- omitting these makes searching for them return nothing.
            OR pm.guardian_first_name ILIKE v_pattern ESCAPE '\'
            OR pm.guardian_last_name  ILIKE v_pattern ESCAPE '\'
          )
      )
    )
  ORDER BY COALESCE(pr.cnt, 0) DESC, u.email
  LIMIT p_limit;
END;
$$;

REVOKE ALL     ON FUNCTION public.admin_account_list(text, boolean, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_account_list(text, boolean, integer) FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_account_list(text, boolean, integer) TO authenticated;


-- ---------------------------------------------------------------------------
-- Post-apply verification
-- ---------------------------------------------------------------------------
-- 1. Forgery closed, and markVolunteerSeen() still works. BOTH must be checked,
--    from a session with a non-NULL auth.uid() — the SQL editor passes this
--    vacuously. Run inside a transaction and ROLLBACK:
--      * update account_settings set volunteer_last_seen_at = now() where id = <member>
--        → succeeds
--      * update account_settings set role_updated_by = <other uuid> where id = <member>
--        → succeeds, but role_updated_by is UNCHANGED afterwards
--      * admin grants a role → role_updated_by = the acting admin
--
-- 2. Unique index present and enforcing:
--      SELECT indexdef FROM pg_indexes
--       WHERE tablename = 'profiles' AND indexname = 'profiles_one_volunteer_per_account_idx';
--    then two inserts of person_type='volunteer' for one account → second raises 23505.
--
-- 3. Wildcards are literal: admin_account_list('%') returns 0 rows, not everything.
--
-- 4. Grants unchanged: anon=false / authenticated=true on admin_account_list;
--    anon=false / authenticated=false on prevent_self_role_change.
--
-- 5. get_advisors: no new findings beyond the accepted baseline.

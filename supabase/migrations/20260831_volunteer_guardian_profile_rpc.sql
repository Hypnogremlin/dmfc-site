-- Volunteer system — close the adults_only bypass and the double-guardian bug.
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new
--
-- STATUS: APPLIED 2026-09-01 via the Supabase MCP (ledger: volunteer_guardian_profile_rpc).
-- Verified post-apply; see this file's README row for the six behavioural tests.
-- DO NOT RE-RUN. Written 2026-08-31, originally to be hand-applied, per
-- this folder's convention (migrations are applied manually, never by an agent).
--
-- WHY THIS FILE EXISTS — two defects, both confirmed by reading the live
-- catalog on 2026-08-31 (project gevdecxvpvopvdjjpaum), not merely from source:
--
--   1. adults_only was enforced by ABSENCE of evidence, not presence of it.
--      claim_volunteer_slot reads only `birthday` and treats NULL as "adult",
--      on the stated assumption that a NULL birthday means a guardian row and
--      "a guardian row is by definition an adult." That assumption is
--      member-controllable. Verified live:
--        * public.profiles has exactly ONE policy, "Owners manage their
--          members", FOR ALL, USING and WITH CHECK both
--          `(select auth.uid()) = account_owner_id` — no column and no
--          person_type restriction of any kind.
--        * `authenticated` holds INSERT on public.profiles.
--        * profiles_athlete_required_fields is
--          `person_type <> 'athlete' OR (birthday IS NOT NULL AND ...)` — it
--          binds only athletes, so a non-athlete row needs nothing but the
--          columns that stayed NOT NULL.
--        * The only person_type guard, profiles_person_type_guard, is
--          `BEFORE UPDATE ... EXECUTE FUNCTION prevent_person_type_change()`.
--          There is NO INSERT trigger.
--      So any member — including a fourteen-year-old on the family login —
--      could POST /rest/v1/profiles with {person_type:'guardian', birthday:null,
--      account_owner_id:<self>, first_name, last_name, contact_email,
--      contact_phone}, satisfy every constraint, and then pass the adults_only
--      check with that id.
--
--   2. Lazy guardian creation was an unconditional INSERT with no lookup
--      (src/app/member/volunteer/actions.ts). Verified live: the only unique
--      index on person_type is profiles_one_volunteer_per_account_idx, whose
--      predicate is `WHERE person_type = 'volunteer'` — guardians are
--      deliberately NOT covered, because two parents on one account are
--      legitimate. A double-tap or a retried request therefore created two
--      guardian rows for one human, with distinct ids that
--      volunteer_signups_live_idx (slot_id, attendee_profile_id) cannot
--      collapse — one person could occupy two seats in a capacity-3 slot.
--
-- WHAT IT DOES NOT DO — read this before assuming adults_only is now a security
-- boundary. It is not, and it cannot be made one with the data this club has:
--   * The "Someone else…" path passes a free-text name with no profile at all,
--     and has always been accepted for an adults_only slot. Anyone can type an
--     adult's name. That is by design (VOLUNTEERS.md's candidate resolution)
--     and is unchanged here.
--   * guardian_* columns on an athlete row are member-writable, so a member can
--     still seed a guardian profile from data they made up. The bar is now
--     meaningfully higher — it requires overwriting the parent recorded on
--     their own athlete row, which is waiver evidence and is visible to staff —
--     but it is a bar, not a wall.
--   * A self-serve `volunteer` row (D14) is self-asserted adulthood and is
--     still insertable by a member, by design; the one-per-account partial
--     unique index caps it at one. D14's "creates no new attack surface" now
--     carries this caveat: such a row can take an adults_only slot.
-- What this file removes is the ability to hand-craft an arbitrary non-athlete
-- profile row directly, and it makes the adult test read positively.
--
-- Idempotent throughout: CREATE OR REPLACE FUNCTION, CREATE UNIQUE INDEX IF NOT
-- EXISTS, DROP TRIGGER IF EXISTS before CREATE. Both triggers/indexes here are
-- on public.profiles, which `postgres` owns, so the house DROP/CREATE pattern
-- applies (unlike M1 Part 3's auth.users trigger).
--
-- REVOKE pattern per supabase/migrations/README.md's corrected lesson: this
-- project's default privileges grant EXECUTE directly to anon/authenticated at
-- creation time, so `REVOKE ... FROM PUBLIC` alone does NOTHING. Every REVOKE
-- below names the role explicitly. Verify with has_function_privilege() for
-- EVERY role, not just `authenticated`.


-- ---------------------------------------------------------------------------
-- Part 1 — one guardian identity per account
-- ---------------------------------------------------------------------------
-- Deliberately keyed on (account, normalized name) and NOT on account alone:
-- two parents per account are legitimate and D2 rejects any design that
-- collapses Mom and Dad. Phone is left out of the key on purpose — a stale
-- guardian_phone on one child's row is exactly the drift that would let the
-- same parent through twice.
--
-- Safe to add with no backfill: verified live 2026-08-31, public.profiles holds
-- 59 rows, ALL person_type='athlete' — zero guardian rows exist, so this index
-- cannot fail to build and no duplicate cleanup is owed.

CREATE UNIQUE INDEX IF NOT EXISTS profiles_one_guardian_identity_per_account_idx
  ON public.profiles (account_owner_id, lower(btrim(first_name)), lower(btrim(last_name)))
  WHERE person_type = 'guardian';


-- ---------------------------------------------------------------------------
-- Part 2 — create_guardian_profile(): the only way a guardian row is born
-- ---------------------------------------------------------------------------
-- Replaces the client-side INSERT in claimSlot(). Three properties matter, in
-- this order:
--
--   (a) It verifies the source profile belongs to the caller. A stranger's
--       profile id resolves to nothing and raises.
--   (b) It seeds STRICTLY from that source's guardian_* columns and the
--       caller's own login. The member supplies one uuid and nothing else, so
--       there is no field for them to hand-craft — no birthday, no
--       account_owner_id, no person_type.
--   (c) It is lookup-or-create. A double-tap returns the existing row's id
--       instead of minting a second person.
--
-- Never writes BACK to guardian_* (VOLUNTEERS.md D3): those columns are waiver
-- evidence for a specific athlete and season; this row is an operational record
-- of someone who works shifts. Seeded once, then allowed to diverge.

CREATE OR REPLACE FUNCTION public.create_guardian_profile(p_seeded_from uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid   uuid := (select auth.uid());
  v_src   public.profiles%ROWTYPE;
  v_first text;
  v_last  text;
  v_email text;
  v_id    uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_src
  FROM public.profiles
  WHERE id = p_seeded_from AND account_owner_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'source profile not on this account';
  END IF;

  v_first := btrim(coalesce(v_src.guardian_first_name, ''));
  v_last  := btrim(coalesce(v_src.guardian_last_name, ''));

  -- contact_phone is NOT NULL on profiles, so a guardian with no recorded
  -- phone cannot become a row at all. candidatesFor() already refuses to offer
  -- such a phantom; this is the enforcing copy of that rule.
  IF v_first = '' OR btrim(coalesce(v_src.guardian_phone, '')) = '' THEN
    RAISE EXCEPTION 'that guardian record has no name or no phone on file';
  END IF;

  -- Lookup first. Matches the Part 1 index expression exactly, so the common
  -- case never reaches the INSERT.
  SELECT id INTO v_id
  FROM public.profiles
  WHERE account_owner_id = v_uid
    AND person_type = 'guardian'
    AND lower(btrim(first_name)) = lower(v_first)
    AND lower(btrim(last_name))  = lower(v_last);

  IF FOUND THEN
    RETURN v_id;
  END IF;

  -- contact_email is NOT NULL. The login's own address is the truthful value
  -- for a person who works shifts (and is what M1's resolveOwnerName() matches
  -- on to pick the right adult for the dashboard greeting); the athlete's
  -- contact_email is the fallback for a phone-only login.
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  v_email := coalesce(nullif(btrim(coalesce(v_email, '')), ''), v_src.contact_email);
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'no email on file for this account';
  END IF;

  -- Two callers can pass the lookup above simultaneously; the unique index is
  -- what actually closes that window, so the race is caught rather than
  -- prevented. Returning the winner's id (not raising) keeps a double-tap
  -- indistinguishable from a single tap to the member, which is the point.
  BEGIN
    PERFORM set_config('app.trusted_profile_insert', 'on', true);

    INSERT INTO public.profiles (
      account_owner_id, person_type, first_name, last_name,
      contact_email, contact_phone, guardian_relationship
    )
    VALUES (
      v_uid, 'guardian', v_first, v_last,
      v_email, btrim(v_src.guardian_phone), v_src.guardian_relationship
    )
    RETURNING id INTO v_id;

    PERFORM set_config('app.trusted_profile_insert', 'off', true);
  EXCEPTION WHEN unique_violation THEN
    -- The failed statement rolled back to this block's implicit savepoint, and
    -- so did the GUC set inside it, so nothing needs resetting here.
    SELECT id INTO v_id
    FROM public.profiles
    WHERE account_owner_id = v_uid
      AND person_type = 'guardian'
      AND lower(btrim(first_name)) = lower(v_first)
      AND lower(btrim(last_name))  = lower(v_last);
    IF v_id IS NULL THEN
      RAISE;
    END IF;
  END;

  RETURN v_id;
END;
$$;

REVOKE ALL     ON FUNCTION public.create_guardian_profile(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_guardian_profile(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_guardian_profile(uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- Part 3 — close the INSERT path a member could hand-craft
-- ---------------------------------------------------------------------------
-- The counterpart to M3.5's prevent_person_type_change(), which is BEFORE
-- UPDATE only and therefore never saw an INSERT.
--
-- 'athlete' and 'volunteer' stay member-insertable: the enrollment wizard
-- writes the first, and D14's self-serve "I'm not a fencer" branch writes the
-- second (src/app/member/enroll/volunteer/actions.ts) — both from the member's
-- own session client. Only 'guardian' is closed, because it is the only type
-- with a definer-owned creation path, and it is the type whose NULL birthday
-- the adults_only check leans on.
--
-- The gate is a transaction-local GUC set inside create_guardian_profile.
-- SECURITY DEFINER does not change auth.uid() (it is a JWT claim, not a
-- session role), so the trigger cannot tell "the RPC" from "a member" any other
-- way. A member cannot set this GUC: PostgREST exposes no set_config, only the
-- functions this schema publishes, and none of them takes a setting name.
-- `true` scopes it to the transaction, so it cannot leak into a later request
-- on a pooled connection.
--
-- auth.uid() IS NULL is the trusted-context escape, the same boundary M1
-- established and whose reasoning is recorded at length in VOLUNTEERS.md: the
-- SQL Editor, the service role, migrations and cron carry no end-user JWT and
-- already own this table; a member over /rest/v1 always has a non-null uid.

CREATE OR REPLACE FUNCTION public.prevent_person_type_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (select auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.person_type IN ('athlete', 'volunteer') THEN
    RETURN NEW;
  END IF;

  IF coalesce(current_setting('app.trusted_profile_insert', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'a % profile may only be created by create_guardian_profile()', NEW.person_type;
END;
$$;

DROP TRIGGER IF EXISTS profiles_person_type_insert_guard ON public.profiles;
CREATE TRIGGER profiles_person_type_insert_guard
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_person_type_insert();

REVOKE ALL     ON FUNCTION public.prevent_person_type_insert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_person_type_insert() FROM anon, authenticated;


-- ---------------------------------------------------------------------------
-- Part 4 — claim_volunteer_slot(): test adulthood positively
-- ---------------------------------------------------------------------------
-- Identical to the live version except for the adults_only block. The old test
--
--   IF v_adults AND v_birthday IS NOT NULL
--      AND v_birthday > (CURRENT_DATE - INTERVAL '18 years')
--
-- fails OPEN for every row whose birthday is NULL, whatever the reason. The new
-- one asks what kind of person the attendee is and, for an athlete, requires a
-- birthday that proves adulthood — so a birthday-less athlete row (impossible
-- today under profiles_athlete_required_fields, but one constraint away from
-- possible) is refused rather than waved through.
--
-- Free-text attendees (p_attendee_id IS NULL) are still allowed on an
-- adults_only slot, unchanged: "Someone else…" carries no record to check, and
-- refusing it would break the escape hatch that exists precisely for the adult
-- who has no profile yet.

CREATE OR REPLACE FUNCTION public.claim_volunteer_slot(
  p_slot_id       uuid,
  p_attendee_id   uuid DEFAULT NULL,
  p_attendee_name text DEFAULT NULL,
  p_credit_id     uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid         uuid := (select auth.uid());
  v_capacity    integer;
  v_adults      boolean;
  v_taken       integer;
  v_birthday    date;
  v_person_type text;
  v_id          uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_attendee_id IS NULL AND (p_attendee_name IS NULL OR btrim(p_attendee_name) = '') THEN
    RAISE EXCEPTION 'an attendee is required';
  END IF;

  -- Lock the slot so a concurrent claim on the same row waits behind this
  -- transaction rather than reading a stale count.
  SELECT capacity, adults_only INTO v_capacity, v_adults
  FROM public.volunteer_slots WHERE id = p_slot_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'slot not found';
  END IF;

  -- The attendee, if a real profile, must belong to the calling account —
  -- otherwise a hand-crafted request could claim a slot "as" a stranger's
  -- profile id.
  IF p_attendee_id IS NOT NULL THEN
    SELECT birthday, person_type INTO v_birthday, v_person_type
    FROM public.profiles
    WHERE id = p_attendee_id AND account_owner_id = v_uid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'attendee not on this account';
    END IF;
  END IF;

  IF v_adults AND p_attendee_id IS NOT NULL THEN
    IF v_person_type = 'athlete' THEN
      -- An athlete's age is recorded, so it is checked. No birthday means no
      -- proof of adulthood: refuse, rather than read the NULL as "adult".
      IF v_birthday IS NULL OR v_birthday > (CURRENT_DATE - INTERVAL '18 years') THEN
        RAISE EXCEPTION 'this role is adults only';
      END IF;
    ELSIF v_person_type IN ('guardian', 'volunteer') THEN
      -- Adults by their creation path, not by an absent column: a guardian row
      -- exists only via create_guardian_profile (Part 2/3), and a volunteer row
      -- is a self-declared adult supporter (D14). Neither carries a birthday
      -- and neither is asked for one — that was D2's privacy decision.
      NULL;
    ELSE
      -- A person_type this function has never heard of. Fail closed so adding
      -- a fourth type is a deliberate edit here, not a silent widening.
      RAISE EXCEPTION 'this role is adults only';
    END IF;
  END IF;

  SELECT count(*) INTO v_taken FROM public.volunteer_signups
  WHERE slot_id = p_slot_id AND cancelled_at IS NULL;

  IF v_taken >= v_capacity THEN
    RAISE EXCEPTION 'slot is full';
  END IF;

  INSERT INTO public.volunteer_signups
    (slot_id, account_id, attendee_profile_id, attendee_name, credit_profile_id)
  VALUES (p_slot_id, v_uid, p_attendee_id, NULLIF(btrim(p_attendee_name), ''), p_credit_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- CREATE OR REPLACE keeps the existing ACL, so these three are restatement
-- rather than repair — kept so the file is correct run standalone too.
REVOKE ALL     ON FUNCTION public.claim_volunteer_slot(uuid, uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_volunteer_slot(uuid, uuid, text, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.claim_volunteer_slot(uuid, uuid, text, uuid) TO authenticated;

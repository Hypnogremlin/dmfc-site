"use server";

import { redirect } from "next/navigation";
import { Resend } from "resend";
import { createSessionClient } from "@/lib/supabase-server";
import {
  MembershipFormData,
  MEMBERSHIP_SEASON,
} from "@/lib/member-types";
import { validateMembershipForm } from "@/lib/membership-validation";
import { MembershipConfirmation, subject as confirmationSubject } from "@/emails/MembershipConfirmation";
import { MembershipNotification, subject as notificationSubject } from "@/emails/MembershipNotification";
import type { WeaponClass } from "@/lib/member-types";

// Weapon-specific staff routing, mirroring src/app/observe/actions.ts.
const WEAPON_EMAILS: Record<WeaponClass, string> = {
  "foil-youth": "dmfcfoil@gmail.com",
  "foil-adult": "dmfcfoil@gmail.com",
  epee: "dmfcepee@gmail.com",
  saber: "dmfcsaber@gmail.com",
};

// Enroll a new member (no profileId) or update an existing member owned by the
// signed-in account (profileId given). The login is always recorded as the
// member's account_owner_id; RLS guarantees an owner can only touch their own
// members and the child rows beneath them.
export async function submitMembershipForm(
  data: MembershipFormData,
  profileId?: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSessionClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error: "Not authenticated. Please sign in again." };
  }

  // 0. Server-side validation. The client (`MembershipForm.tsx`) already runs
  // these checks step-by-step for UX, but that's just JS in the browser — a
  // request can reach this action with none of it applied. Re-run the same
  // rules (shared via @/lib/membership-validation) here so a member can never
  // be marked enrollment_complete without the required fields and signatures.
  const validationErrors = validateMembershipForm(data);
  if (Object.keys(validationErrors).length > 0) {
    return {
      ok: false,
      error: "Please complete all required fields and signatures before submitting.",
    };
  }

  // 1. Insert or update the member profile.
  const profilePayload = {
    account_owner_id: user.id,
    first_name: data.first_name,
    last_name: data.last_name,
    birthday: data.birthday,
    usa_citizen: data.usa_citizen,
    sex_at_birth: data.sex_at_birth || null,
    gender_identity: data.gender_identity || null,
    weapon_classes: data.weapon_classes,
    shirt_size: data.shirt_size || null,
    contact_email: data.contact_email,
    contact_phone: data.contact_phone,
    address_line1: data.address_line1,
    address_line2: data.address_line2 || null,
    city: data.city,
    state: data.state,
    zip_code: data.zip_code,
    guardian_first_name: data.guardian_first_name || null,
    guardian_last_name: data.guardian_last_name || null,
    guardian_relationship: data.guardian_relationship || null,
    guardian_phone: data.guardian_phone || null,
    membership_season: MEMBERSHIP_SEASON,
    // citizenship_country otherwise silently defaults to 'US' at the DB level
    // (see 20260703_usaf_citizenship_fields.sql) even for a self-reported
    // non-citizen, which would report a wrong ISO code to USA Fencing without
    // anyone noticing. Flag it with an invalid sentinel instead so it surfaces
    // as a visible error at USAF upload time, prompting the president to
    // resolve the fencer's real country code by hand. Only seeded on initial
    // enrollment (never on edit) so a later self-service edit can't clobber
    // an admin's manual correction back to "!" or the wrong default.
    ...(!profileId
      ? { citizenship_country: data.usa_citizen ? "US" : "!" }
      : {}),
    // enrollment_complete is intentionally NOT set here. It only flips to
    // true once the emergency-contact, medical, and waiver writes below all
    // succeed (see step 5) — otherwise a member whose waiver write failed
    // would look "Active" with no waiver row, and the weekly USAF cron
    // (which selects on enrollment_complete = true) would report them with
    // blank waiver flags.
  };

  let memberId: string;

  if (profileId) {
    // Update an existing member. RLS limits this to the owner's own rows, so a
    // mismatched id simply affects zero rows — which we detect via .select().
    // The `person_type` filter is the actual security boundary for "a
    // guardian row cannot be pushed through the athlete form's write path" —
    // src/app/member/enroll/page.tsx's guard against loading a guardian
    // profile into this form is UX, not enforcement; a hand-crafted request
    // straight to this action bypasses that page entirely. Unreachable today
    // (no guardian rows exist until M3), but the filter belongs on the write
    // path regardless, matching the belt-and-suspenders already applied to
    // the read paths in VOLUNTEERS.md's "Blast radius of person_type".
    const { data: updated, error: profileError } = await supabase
      .from("profiles")
      .update(profilePayload)
      .eq("id", profileId)
      .eq("person_type", "athlete")
      .select("id")
      .single();

    if (profileError || !updated) {
      return {
        ok: false,
        error: profileError?.message ?? "Member not found.",
      };
    }
    memberId = updated.id;
  } else {
    // New member — let the DB assign a fresh id (gen_random_uuid).
    const { data: inserted, error: profileError } = await supabase
      .from("profiles")
      .insert(profilePayload)
      .select("id")
      .single();

    if (profileError || !inserted) {
      return {
        ok: false,
        error: profileError?.message ?? "Could not create member.",
      };
    }
    memberId = inserted.id;
  }

  // 2. Upsert emergency contacts (keyed by profile + order).
  const hasEc2 =
    data.ec2_last_name.trim() &&
    data.ec2_first_name.trim() &&
    data.ec2_phone.trim();

  const ecRows = [
    {
      profile_id: memberId,
      contact_order: 1,
      last_name: data.ec1_last_name,
      first_name: data.ec1_first_name,
      relationship: data.ec1_relationship,
      email: data.ec1_email || null,
      phone: data.ec1_phone,
      address_line1: data.ec1_address_line1 || null,
      address_line2: data.ec1_address_line2 || null,
      city: data.ec1_city || null,
      state: data.ec1_state || null,
      zip_code: data.ec1_zip_code || null,
    },
    // Only include EC2 if the required fields are filled in
    ...(hasEc2
      ? [
          {
            profile_id: memberId,
            contact_order: 2,
            last_name: data.ec2_last_name,
            first_name: data.ec2_first_name,
            relationship: data.ec2_relationship,
            email: data.ec2_email || null,
            email_2: data.ec2_email_2 || null,
            phone: data.ec2_phone,
            phone_2: data.ec2_phone_2 || null,
            address_line1: data.ec2_address_line1 || null,
            address_line2: data.ec2_address_line2 || null,
            city: data.ec2_city || null,
            state: data.ec2_state || null,
            zip_code: data.ec2_zip_code || null,
          },
        ]
      : []),
  ];

  const { error: ecError } = await supabase
    .from("emergency_contacts")
    .upsert(ecRows, { onConflict: "profile_id,contact_order" });

  if (ecError) {
    return { ok: false, error: ecError.message };
  }

  // On an edit where EC2 was cleared, remove the previously-saved second contact.
  // Skip this on new enrollments — no EC2 row exists yet.
  if (profileId && !hasEc2) {
    const { error: ec2DeleteError } = await supabase
      .from("emergency_contacts")
      .delete()
      .eq("profile_id", memberId)
      .eq("contact_order", 2);

    if (ec2DeleteError) {
      return { ok: false, error: ec2DeleteError.message };
    }
  }

  // 3. Upsert member_medical
  const { error: medicalError } = await supabase
    .from("member_medical")
    .upsert(
      {
        profile_id: memberId,
        medical_conditions: data.medical_conditions || null,
        preferred_medical_system: data.preferred_medical_system || null,
      },
      { onConflict: "profile_id" }
    );

  if (medicalError) {
    return { ok: false, error: medicalError.message };
  }

  // 4. Upsert member_waivers
  // Signer is derived from athlete age in the form. *_signed_at is stamped
  // only for signatures that were actually provided (guardian fields stay
  // null for adult athletes). On edits, omit all *_signed_at fields so the
  // original signing timestamps are preserved in the DB.
  const now = new Date().toISOString();
  const waiverPayload = {
    profile_id: memberId,
    season_year: MEMBERSHIP_SEASON,
    // 1. Rules of the Club
    rules_club_athlete_agreed: data.rules_club_athlete_agreed,
    rules_club_athlete_signature: data.rules_club_athlete_signature || null,
    rules_club_guardian_agreed: data.rules_club_guardian_agreed,
    rules_club_guardian_signature: data.rules_club_guardian_signature || null,
    // 2. Athlete Code of Conduct
    athlete_coc_agreed: data.athlete_coc_agreed,
    athlete_coc_signature: data.athlete_coc_signature || null,
    // 3. Parent Code of Conduct (minors only)
    parent_coc_agreed: data.parent_coc_agreed,
    parent_coc_signature: data.parent_coc_signature || null,
    // 4. Individual Membership Waiver
    individual_waiver_agreed: data.individual_waiver_agreed,
    individual_waiver_signature: data.individual_waiver_signature || null,
    // 5. MAAPP Waiver
    maapp_agreed: data.maapp_agreed,
    maapp_signature: data.maapp_signature || null,
    // 6. Photo & Video Release
    photo_release_agreed: data.photo_release_agreed,
    photo_release_signature: data.photo_release_signature || null,
    // Include signing timestamps only on first enrollment — never overwrite
    // existing evidence on subsequent edits.
    ...(!profileId
      ? {
          rules_club_athlete_signed_at: data.rules_club_athlete_signature ? now : null,
          rules_club_guardian_signed_at: data.rules_club_guardian_signature ? now : null,
          athlete_coc_signed_at: data.athlete_coc_signature ? now : null,
          parent_coc_signed_at: data.parent_coc_signature ? now : null,
          individual_waiver_signed_at: data.individual_waiver_signature ? now : null,
          maapp_signed_at: data.maapp_signature ? now : null,
          photo_release_signed_at: data.photo_release_signature ? now : null,
        }
      : {}),
  };

  const { error: waiverError } = await supabase
    .from("member_waivers")
    .upsert(waiverPayload, { onConflict: "profile_id,season_year" });

  if (waiverError) {
    return { ok: false, error: waiverError.message };
  }

  // 5. Every child write succeeded — now (and only now) mark the member
  // enrollment complete. `person_type` filter guards the write path the same
  // way as the update above — a guardian row must never end up
  // enrollment_complete, since that would put it in front of the weekly
  // USAF report query (see src/lib/cron/usafReport.ts).
  const { error: completeError } = await supabase
    .from("profiles")
    .update({ enrollment_complete: true })
    .eq("id", memberId)
    .eq("person_type", "athlete");

  if (completeError) {
    return { ok: false, error: completeError.message };
  }

  // 6. Send confirmation email (non-fatal on failure — enrollment already
  // succeeded and saved above). Only on first enrollment: an edit isn't
  // "signing up" again, and re-sending would misreport unchanged
  // *_signed_at timestamps as freshly signed.
  if (!profileId) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const FROM = "Des Moines Fencing Club <noreply@emails.desmoinesfencingclub.org>";
      const athleteName = `${data.first_name} ${data.last_name}`;
      const submittedAt = new Date().toISOString();

      // Notification to club staff (president + relevant weapon coaches).
      const weaponRecipients = [
        ...new Set(data.weapon_classes.map((w) => WEAPON_EMAILS[w])),
      ];
      const { error: notifError } = await resend.emails.send({
        from: FROM,
        to: ["DMFCPresident@gmail.com", ...weaponRecipients],
        subject: notificationSubject(athleteName),
        react: MembershipNotification({
          athleteName,
          contactEmail: data.contact_email,
          contactPhone: data.contact_phone,
          weaponClasses: data.weapon_classes,
          season: MEMBERSHIP_SEASON,
          submittedAt,
        }),
      });
      if (notifError) console.error("[member] Notification send error:", notifError);

      // Confirmation to the member/family.
      const { error: confirmError } = await resend.emails.send({
        from: FROM,
        to: data.contact_email,
        subject: confirmationSubject(data.first_name),
        react: MembershipConfirmation({
          athleteName,
          season: MEMBERSHIP_SEASON,
          weaponClasses: data.weapon_classes,
          rulesOfClubAgreed:
            data.rules_club_athlete_agreed || data.rules_club_guardian_agreed,
          athleteCocAgreed: data.athlete_coc_agreed,
          parentCocAgreed: data.parent_coc_agreed,
          individualWaiverAgreed: data.individual_waiver_agreed,
          maappAgreed: data.maapp_agreed,
          photoReleaseAgreed: data.photo_release_agreed,
        }),
      });
      if (confirmError) console.error("[member] Confirmation send error:", confirmError);
    } catch (emailErr) {
      console.error("[member] Confirmation email error:", emailErr);
    }
  }

  return { ok: true };
}

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/login");
}

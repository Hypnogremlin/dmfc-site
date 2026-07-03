"use server";

import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase-server";
import {
  MembershipFormData,
  MEMBERSHIP_SEASON,
} from "@/lib/member-types";

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
    enrollment_complete: true,
  };

  let memberId: string;

  if (profileId) {
    // Update an existing member. RLS limits this to the owner's own rows, so a
    // mismatched id simply affects zero rows — which we detect via .select().
    const { data: updated, error: profileError } = await supabase
      .from("profiles")
      .update(profilePayload)
      .eq("id", profileId)
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

  return { ok: true };
}

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/login");
}

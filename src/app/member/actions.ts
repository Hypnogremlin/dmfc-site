"use server";

import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase-server";
import {
  MembershipFormData,
  MEMBERSHIP_SEASON,
} from "@/lib/member-types";

export async function submitMembershipForm(
  data: MembershipFormData
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSessionClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error: "Not authenticated. Please sign in again." };
  }

  // 1. Upsert profile
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
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
      membership_season: MEMBERSHIP_SEASON,
      enrollment_complete: true,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  // 2. Upsert emergency contacts
  const { error: ecError } = await supabase
    .from("emergency_contacts")
    .upsert(
      [
        {
          profile_id: user.id,
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
        {
          profile_id: user.id,
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
      ],
      { onConflict: "profile_id,contact_order" }
    );

  if (ecError) {
    return { ok: false, error: ecError.message };
  }

  // 3. Upsert member_medical
  const { error: medicalError } = await supabase
    .from("member_medical")
    .upsert(
      {
        profile_id: user.id,
        medical_conditions: data.medical_conditions || null,
        preferred_medical_system: data.preferred_medical_system || null,
      },
      { onConflict: "profile_id" }
    );

  if (medicalError) {
    return { ok: false, error: medicalError.message };
  }

  // 4. Upsert member_waivers
  const now = new Date().toISOString();
  const { error: waiverError } = await supabase
    .from("member_waivers")
    .upsert(
      {
        profile_id: user.id,
        season_year: MEMBERSHIP_SEASON,
        dmfc_rules_agreed: data.dmfc_rules_agreed,
        dmfc_rules_signature: data.dmfc_rules_signature || null,
        dmfc_rules_signed_at: now,
        dmfc_rules_signer_type: data.dmfc_rules_signer_type || null,
        usa_fencing_agreed: data.usa_fencing_agreed,
        usa_fencing_signature: data.usa_fencing_signature || null,
        usa_fencing_signed_at: now,
        usa_fencing_signer_type: data.usa_fencing_signer_type || null,
      },
      { onConflict: "profile_id,season_year" }
    );

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

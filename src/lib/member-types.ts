export type WeaponClass = "foil-youth" | "foil-adult" | "epee" | "saber";
export type SexAtBirth = "male" | "female";
export type ShirtSize = "YXS" | "YS" | "YM" | "YL" | "YXL" | "XS" | "S" | "M" | "L" | "XL" | "XXL" | "XXXL";
export type SignerType = "athlete" | "guardian";

export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  birthday: string;
  usa_citizen: boolean;
  sex_at_birth: SexAtBirth;
  gender_identity: string | null;
  weapon_classes: WeaponClass[];
  shirt_size: ShirtSize | null;
  contact_email: string;
  contact_phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip_code: string;
  guardian_first_name: string | null;
  guardian_last_name: string | null;
  guardian_relationship: string | null;
  guardian_phone: string | null;
  // Admin-managed: set on the backend, never by the member through the form.
  usa_fencing_number: string | null;
  membership_season: string | null;
  enrollment_complete: boolean;
  created_at: string;
  updated_at: string;
};

export type EmergencyContact = {
  id: string;
  profile_id: string;
  contact_order: 1 | 2;
  last_name: string;
  first_name: string;
  relationship: string;
  email: string | null;
  email_2: string | null;
  phone: string;
  phone_2: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  created_at: string;
};

export type MemberMedical = {
  id: string;
  profile_id: string;
  medical_conditions: string | null;
  preferred_medical_system: string | null;
  created_at: string;
  updated_at: string;
};

export type MemberWaiver = {
  id: string;
  profile_id: string;
  season_year: string;
  // 1. Rules of the Club — athlete always signs; guardian also signs for minors
  rules_club_athlete_agreed: boolean;
  rules_club_athlete_signature: string | null;
  rules_club_athlete_signed_at: string | null;
  rules_club_guardian_agreed: boolean;
  rules_club_guardian_signature: string | null;
  rules_club_guardian_signed_at: string | null;
  // 2. Athlete Code of Conduct — athlete signs
  athlete_coc_agreed: boolean;
  athlete_coc_signature: string | null;
  athlete_coc_signed_at: string | null;
  // 3. Parent Code of Conduct — guardian signs (minors only)
  parent_coc_agreed: boolean;
  parent_coc_signature: string | null;
  parent_coc_signed_at: string | null;
  // 4. Individual Membership Waiver — athlete (adult) or guardian (minor)
  individual_waiver_agreed: boolean;
  individual_waiver_signature: string | null;
  individual_waiver_signed_at: string | null;
  // 5. MAAPP Waiver — athlete (adult) or guardian (minor)
  maapp_agreed: boolean;
  maapp_signature: string | null;
  maapp_signed_at: string | null;
  created_at: string;
};

export type MembershipFormData = {
  first_name: string;
  last_name: string;
  birthday: string;
  usa_citizen: boolean;
  sex_at_birth: SexAtBirth | "";
  gender_identity: string;
  weapon_classes: WeaponClass[];
  shirt_size: ShirtSize | "";
  contact_email: string;
  contact_phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip_code: string;
  ec1_last_name: string;
  ec1_first_name: string;
  ec1_relationship: string;
  ec1_email: string;
  ec1_phone: string;
  ec1_address_line1: string;
  ec1_address_line2: string;
  ec1_city: string;
  ec1_state: string;
  ec1_zip_code: string;
  ec2_last_name: string;
  ec2_first_name: string;
  ec2_relationship: string;
  ec2_email: string;
  ec2_email_2: string;
  ec2_phone: string;
  ec2_phone_2: string;
  ec2_address_line1: string;
  ec2_address_line2: string;
  ec2_city: string;
  ec2_state: string;
  ec2_zip_code: string;
  guardian_first_name: string;
  guardian_last_name: string;
  guardian_relationship: string;
  guardian_phone: string;
  medical_conditions: string;
  preferred_medical_system: string;
  // ── Agreements & waivers (signer derived from athlete age) ──
  // 1. Rules of the Club — athlete always; guardian also when minor
  rules_club_athlete_agreed: boolean;
  rules_club_athlete_signature: string;
  rules_club_guardian_agreed: boolean;
  rules_club_guardian_signature: string;
  // 2. Athlete Code of Conduct — athlete
  athlete_coc_agreed: boolean;
  athlete_coc_signature: string;
  // 3. Parent Code of Conduct — guardian (minors only)
  parent_coc_agreed: boolean;
  parent_coc_signature: string;
  // 4. Individual Membership Waiver — athlete (adult) or guardian (minor)
  individual_waiver_agreed: boolean;
  individual_waiver_signature: string;
  // 5. MAAPP Waiver — athlete (adult) or guardian (minor)
  maapp_agreed: boolean;
  maapp_signature: string;
};

export const MEMBERSHIP_SEASON = "2026-27";

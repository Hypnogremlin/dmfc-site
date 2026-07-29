export type WeaponClass = "foil-youth" | "foil-adult" | "epee" | "saber";
export type SexAtBirth = "male" | "female";
export type ShirtSize = "YXS" | "YS" | "YM" | "YL" | "YXL" | "XS" | "S" | "M" | "L" | "XL" | "XXL" | "XXXL";
export type SignerType = "athlete" | "guardian";

// `profiles` rows are either a fencer ("athlete") or a lazily-created adult
// record standing in for a parent/guardian who has no login-independent
// identity of their own (see VOLUNTEERS.md D2/D3). Guardian rows exist only
// to be a named volunteer signup — they carry no birthday, address, or
// waiver data, which is why the athlete-only columns below are nullable.
export type PersonType = "athlete" | "guardian";

export type Profile = {
  id: string;
  // The login (auth.users.id) that owns this member. One owner may have many
  // member profiles (a family). For pre-family rows this equals id.
  account_owner_id: string;
  person_type: PersonType;
  first_name: string;
  last_name: string;
  // Nullable because a guardian row (person_type = 'guardian') has no
  // birthday — see the profiles_athlete_required_fields CHECK in the M1
  // migration, which still enforces NOT NULL-equivalent for athletes.
  birthday: string | null;
  usa_citizen: boolean;
  sex_at_birth: SexAtBirth | null;
  gender_identity: string | null;
  weapon_classes: WeaponClass[];
  shirt_size: ShirtSize | null;
  contact_email: string;
  contact_phone: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  guardian_first_name: string | null;
  guardian_last_name: string | null;
  guardian_relationship: string | null;
  guardian_phone: string | null;
  // Admin-managed: set on the backend, never by the member through the form.
  usa_fencing_number: string | null;
  // Admin-managed ISO Alpha-2 codes for the USAF bulk upload; default 'US'.
  citizenship_country: string;
  representing_country: string;
  membership_season: string | null;
  enrollment_complete: boolean;
  // Set when this member was included in the weekly USA Fencing report; NULL
  // until then. Keeps each member reported exactly once.
  usaf_reported_at: string | null;
  created_at: string;
  updated_at: string;
};

// Lightweight shape for the dashboard roster (one row per member on an account).
export type MemberSummary = {
  id: string;
  person_type: PersonType;
  first_name: string;
  last_name: string;
  birthday: string | null;
  weapon_classes: WeaponClass[];
  membership_season: string | null;
  enrollment_complete: boolean;
  // Only populated on minor athlete rows; used to resolve the dashboard
  // greeting to the guardian's name rather than the child's. See D2/D3.
  guardian_first_name: string | null;
  // On a guardian row, seeded from auth.users.email at lazy creation time
  // (VOLUNTEERS.md D3) — used to pick out "the guardian who is actually
  // signed in right now" when an account holds more than one. On an
  // athlete row this is the athlete's own contact email and unused for
  // that purpose.
  contact_email: string;
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
  // 6. Photo & Video Release — athlete (adult) or guardian (minor)
  photo_release_agreed: boolean;
  photo_release_signature: string | null;
  photo_release_signed_at: string | null;
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
  // 6. Photo & Video Release — athlete (adult) or guardian (minor)
  photo_release_agreed: boolean;
  photo_release_signature: string;
};

export const MEMBERSHIP_SEASON = "2026-27";

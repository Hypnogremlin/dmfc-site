import type { MembershipFormData } from "@/lib/member-types";
import { calculateAge } from "@/lib/age";

// Shared membership-form validation. `MembershipForm.tsx` calls `validateStep`
// per-step as the athlete/guardian clicks through the wizard; the server
// action calls `validateMembershipForm` (all steps at once) before it will
// mark a member's enrollment complete. Keeping this in one place means the
// client-side UX checks and the server-side trust boundary can never drift
// apart.

export type Errors = Partial<Record<keyof MembershipFormData, string>>;

// Null-safe blank check — tolerates fields that may be transiently `undefined`
// (e.g. stale component state after a dev-server Fast Refresh adds new fields).
function isBlank(v: string | undefined): boolean {
  return !v || !v.trim();
}

export function validateStep(step: number, data: MembershipFormData): Errors {
  const errs: Errors = {};
  const isMinor = calculateAge(data.birthday) < 18;

  if (step === 0) {
    if (!data.first_name.trim()) errs.first_name = "First name is required.";
    if (!data.last_name.trim())  errs.last_name  = "Last name is required.";
    if (!data.birthday)          errs.birthday   = "Birthday is required.";
    if (!data.sex_at_birth)      errs.sex_at_birth = "Please select an option.";
    if (data.weapon_classes.length === 0) errs.weapon_classes = "Select at least one class.";
  }

  if (step === 1) {
    if (isMinor) {
      if (!data.guardian_first_name.trim()) errs.guardian_first_name = "Guardian first name is required.";
      if (!data.guardian_last_name.trim())  errs.guardian_last_name  = "Guardian last name is required.";
      if (!data.guardian_relationship.trim()) errs.guardian_relationship = "Relationship is required.";
      if (!data.guardian_phone.trim()) errs.guardian_phone = "Guardian phone is required.";
    }
    if (!data.contact_email.trim()) errs.contact_email = "Email is required.";
    if (!data.contact_phone.trim()) errs.contact_phone = "Phone is required.";
    if (!data.address_line1.trim()) errs.address_line1 = "Address is required.";
    if (!data.city.trim())          errs.city          = "City is required.";
    if (!data.state)                errs.state         = "State is required.";
    if (!data.zip_code.trim())      errs.zip_code      = "Zip code is required.";
  }

  if (step === 2) {
    if (!data.ec1_last_name.trim())   errs.ec1_last_name   = "Last name is required.";
    if (!data.ec1_first_name.trim())  errs.ec1_first_name  = "First name is required.";
    if (!data.ec1_relationship.trim()) errs.ec1_relationship = "Relationship is required.";
    if (!data.ec1_phone.trim())       errs.ec1_phone       = "Phone is required.";
  }

  if (step === 5) {
    // 1. Rules of the Club — athlete always
    if (isBlank(data.rules_club_athlete_signature)) errs.rules_club_athlete_signature = "Signature is required.";
    if (!data.rules_club_athlete_agreed) errs.rules_club_athlete_agreed = "You must agree to continue.";
    // …guardian too, when the athlete is a minor
    if (isMinor) {
      if (isBlank(data.rules_club_guardian_signature)) errs.rules_club_guardian_signature = "Signature is required.";
      if (!data.rules_club_guardian_agreed) errs.rules_club_guardian_agreed = "You must agree to continue.";
    }

    // 2. Athlete Code of Conduct — athlete always
    if (isBlank(data.athlete_coc_signature)) errs.athlete_coc_signature = "Signature is required.";
    if (!data.athlete_coc_agreed) errs.athlete_coc_agreed = "You must agree to continue.";

    // 3. Parent Code of Conduct — minors only
    if (isMinor) {
      if (isBlank(data.parent_coc_signature)) errs.parent_coc_signature = "Signature is required.";
      if (!data.parent_coc_agreed) errs.parent_coc_agreed = "You must agree to continue.";
    }

    // 4. Individual Membership Waiver — always (signer derived from age)
    if (isBlank(data.individual_waiver_signature)) errs.individual_waiver_signature = "Signature is required.";
    if (!data.individual_waiver_agreed) errs.individual_waiver_agreed = "You must agree to continue.";

    // 5. MAAPP Waiver — always (signer derived from age)
    if (isBlank(data.maapp_signature)) errs.maapp_signature = "Signature is required.";
    if (!data.maapp_agreed) errs.maapp_agreed = "You must agree to continue.";

    // 6. Photo & Video Release — always (signer derived from age)
    if (isBlank(data.photo_release_signature)) errs.photo_release_signature = "Signature is required.";
    if (!data.photo_release_agreed) errs.photo_release_agreed = "You must agree to continue.";
  }

  return errs;
}

// Full-form validation for the server action. Runs every step's rules at
// once (the wizard steps are a UI concept only — the server doesn't know or
// care which page the browser was on) so a request that skips the client
// entirely (or a client with stale/tampered state) can't mark a member
// enrollment_complete without the required fields and signatures.
export function validateMembershipForm(data: MembershipFormData): Errors {
  return {
    ...validateStep(0, data),
    ...validateStep(1, data),
    ...validateStep(2, data),
    ...validateStep(5, data),
  };
}

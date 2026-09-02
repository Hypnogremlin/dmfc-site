import type { VolunteerProfileData } from "@/lib/member-types";

// Validation for the self-serve non-athlete profile (VOLUNTEERS.md D14).
//
// Same shape and same contract as membership-validation.ts: a field→message
// map, an empty object meaning valid, imported by BOTH the client form (for
// per-field UX) and the server action (the actual trust boundary). One module
// so the two can never drift.
//
// Four fields, deliberately. These are exactly the `profiles` columns that
// stayed NOT NULL after M1 relaxed the athlete-only ones — a board member or
// alum is asked for nothing else. No birthday, no address, no sex at birth, no
// emergency contact, no waivers: none of it applies to someone who is not
// stepping onto a strip, and asking for it is both friction and a privacy
// problem (the same reasoning as D2's relaxed constraints).

export type VolunteerProfileErrors = Partial<
  Record<keyof VolunteerProfileData, string>
>;

function isBlank(v: string | undefined): boolean {
  return !v || !v.trim();
}

export function validateVolunteerProfile(
  data: VolunteerProfileData
): VolunteerProfileErrors {
  const errs: VolunteerProfileErrors = {};

  if (isBlank(data.first_name)) errs.first_name = "First name is required.";
  if (isBlank(data.last_name)) errs.last_name = "Last name is required.";

  if (isBlank(data.contact_email)) {
    errs.contact_email = "Email is required.";
  } else if (!data.contact_email.includes("@")) {
    // Deliberately loose. The address is already proven — it's how they signed
    // in — and a stricter regex here would reject valid addresses without
    // catching anything that matters.
    errs.contact_email = "Enter a valid email address.";
  }

  // Required because profiles.contact_phone is NOT NULL, and because a
  // volunteer with no reachable number is useless on a tournament morning —
  // the same reason candidatesFor() refuses to offer a phantom guardian who
  // has a name but no phone on file.
  if (isBlank(data.contact_phone)) errs.contact_phone = "Phone is required.";

  return errs;
}

"use server";

import { createSessionClient } from "@/lib/supabase-server";
import type { VolunteerProfileData } from "@/lib/member-types";
import { validateVolunteerProfile } from "@/lib/volunteer/profile-validation";

type ActionResult = { ok: boolean; error?: string };

// Creates a non-athlete profile for a board member, alum, or supporter
// (VOLUNTEERS.md D14).
//
// This is a SEPARATE FILE from src/app/member/actions.ts on purpose. That
// module is the athlete write path: submitMembershipForm() stamps
// membership_season, writes emergency contacts, a medical record and six
// waivers, and gates its updates on .eq("person_type","athlete"). None of that
// applies here, and the reader's instinct on arriving at a "create a profile"
// action will be to copy that payload — so the boundary is visible in the file
// tree rather than only in a comment.
export async function createVolunteerProfile(
  data: VolunteerProfileData
): Promise<ActionResult> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not authenticated. Please sign in again." };
  }

  // The client already ran this for per-field messages; re-running it here is
  // the trust boundary, matching the comment in member/actions.ts.
  const errors = validateVolunteerProfile(data);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Please complete every field before continuing." };
  }

  // One supporter record per login — the login *is* that person, so a second is
  // always a mistake or a double submit.
  //
  // Deliberately NOT rejecting when the account has athletes on it. A parent
  // who also sits on the board is already representable through the
  // phantom-guardian path (candidatesFor()), but making this action's success
  // depend on unrelated rows buys no safety and produces a confusing refusal.
  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("id")
    .eq("account_owner_id", user.id)
    .eq("person_type", "volunteer")
    .maybeSingle();

  if (existingError) {
    return {
      ok: false,
      error: "Could not check this account. Please try again.",
    };
  }
  if (existing) {
    return {
      ok: false,
      error: "You already have a supporter profile on this account.",
    };
  }

  // Only the columns that stayed NOT NULL, plus the type itself.
  //
  // Absent on purpose, each one a field the athlete path writes here:
  //   membership_season   — a supporter has no season
  //   enrollment_complete — stays false forever; usafReport.ts filters on
  //                         person_type='athlete' AND enrollment_complete, so
  //                         this row is doubly excluded from the USA Fencing
  //                         submission. It must never render as an
  //                         "Incomplete" nag, which is why the dashboard puts
  //                         these rows in the badge-less adults block.
  //   birthday / sex_at_birth / address / citizenship — athlete-only, and
  //                         relaxed to nullable in M1 precisely for this.
  //   emergency contacts / medical / waivers — no separate table writes at all.
  const { error } = await supabase.from("profiles").insert({
    account_owner_id: user.id,
    person_type: "volunteer",
    first_name: data.first_name.trim(),
    last_name: data.last_name.trim(),
    contact_email: data.contact_email.trim(),
    contact_phone: data.contact_phone.trim(),
  });

  if (error) {
    // 23505 = unique_violation, from the partial unique index on
    // (account_owner_id) WHERE person_type = 'volunteer'.
    //
    // The check above is a courtesy that gives a clean message in the ordinary
    // case; it cannot prevent the race, because "look, then insert" is two
    // steps with a gap. A double-click or a retried request can put two calls
    // either side of that gap and both would insert. The index closes it for
    // real — and a second row would be worse than a failed submit, because the
    // .maybeSingle() lookup above then errors permanently on this account.
    if (error.code === "23505") {
      return {
        ok: false,
        error: "You already have a supporter profile on this account.",
      };
    }
    return {
      ok: false,
      error: "Could not create your profile. Please try again.",
    };
  }

  return { ok: true };
}

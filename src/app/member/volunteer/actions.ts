"use server";

import { createSessionClient } from "@/lib/supabase-server";

type ActionResult = { ok: boolean; error?: string };

// Every /member/volunteer/* route is open to any authenticated member — no
// assertRole() gate here, unlike the staff surface. account_id scoping
// inside claim_volunteer_slot/cancel_volunteer_signup (and the RLS behind
// them) is the real boundary, same layering principle staff/actions.ts uses
// for its own tier (assertRole("coach") is UX, RLS is final).

export type ClaimSelection =
  | { kind: "profile"; profileId: string }
  | { kind: "phantom"; seededFrom: string }
  | { kind: "other"; name: string };

export async function claimSlot(slotId: string, selection: ClaimSelection): Promise<ActionResult> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not authenticated. Please sign in again." };
  }

  let attendeeId: string | null = null;
  let attendeeName: string | null = null;

  if (selection.kind === "profile") {
    attendeeId = selection.profileId;
  } else if (selection.kind === "other") {
    const trimmed = selection.name.trim();
    if (!trimmed) {
      return { ok: false, error: "Enter a name." };
    }
    attendeeName = trimmed;
  } else {
    // "phantom" — the first tap on this guardian identity creates their
    // profile, seeded from the source athlete's guardian_* fields (D3).
    // Never written back to those source columns: guardian_* is waiver
    // evidence for a specific athlete/season, and this new row is an
    // independent, operational record of a person who works shifts.
    const { data: source, error: sourceError } = await supabase
      .from("profiles")
      .select("guardian_first_name, guardian_last_name, guardian_phone")
      .eq("id", selection.seededFrom)
      .eq("account_owner_id", user.id)
      .maybeSingle();

    if (sourceError) {
      return { ok: false, error: sourceError.message };
    }
    // candidatesFor() already excludes a phantom with no guardian_phone (see
    // src/lib/volunteer/candidates.ts), so this branch should be unreachable
    // from the picker — kept as defense in depth against a stale candidate
    // list rather than trusted to never fire.
    if (!source || !source.guardian_first_name || !source.guardian_phone) {
      return {
        ok: false,
        error: "That guardian's record is missing a phone number. Use \"Someone else…\" instead.",
      };
    }

    const { data: created, error: createError } = await supabase
      .from("profiles")
      .insert({
        account_owner_id: user.id,
        person_type: "guardian",
        first_name: source.guardian_first_name,
        last_name: source.guardian_last_name ?? "",
        contact_email: user.email,
        contact_phone: source.guardian_phone,
      })
      .select("id")
      .single();

    if (createError || !created) {
      return { ok: false, error: createError?.message ?? "Could not create the guardian profile." };
    }
    attendeeId = created.id;
  }

  const { error: claimError } = await supabase.rpc("claim_volunteer_slot", {
    p_slot_id: slotId,
    p_attendee_id: attendeeId,
    p_attendee_name: attendeeName,
    p_credit_id: null,
  });

  if (claimError) {
    return { ok: false, error: claimError.message };
  }

  return { ok: true };
}

export async function cancelSignup(signupId: string): Promise<ActionResult> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not authenticated. Please sign in again." };
  }

  // The RPC returns boolean (true = cancelled now, false = was already
  // cancelled) and RAISEs for "no such row" / "not your signup" — both
  // outcomes of the boolean return are success from the caller's point of
  // view, mirroring publishEvent's "already done by a double-click" == ok.
  // A raised exception is mapped to member-facing copy rather than passed
  // through raw, since "not your signup" reads like a bug report to a member
  // who just double-clicked a stale page.
  const { error } = await supabase.rpc("cancel_volunteer_signup", { p_signup_id: signupId });
  if (error) {
    return {
      ok: false,
      error: "That signup is no longer available. Refresh the page and try again.",
    };
  }
  return { ok: true };
}

// Called from the list page on every visit. Best-effort: a failure here
// should not block the member from seeing the list, so it has no return
// value for the caller to check — same "non-fatal side effect" shape as the
// email sends in src/app/observe/actions.ts.
export async function markVolunteerSeen(): Promise<void> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("account_settings")
    .update({ volunteer_last_seen_at: new Date().toISOString() })
    .eq("id", user.id);
}

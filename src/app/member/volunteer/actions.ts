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
    //
    // This goes through a SECURITY DEFINER RPC rather than an INSERT from
    // this session client, for two reasons that are not interchangeable:
    //
    //   * The member supplies one uuid and nothing else. The old INSERT sent
    //     a whole row from the client, and profiles' only policy is an
    //     unrestricted FOR ALL on account_owner_id — so a hand-crafted
    //     request could mint a birthday-less 'guardian' row and walk it
    //     straight through claim_volunteer_slot's adults_only check. See
    //     supabase/migrations/20260831_volunteer_guardian_profile_rpc.sql.
    //   * The RPC is lookup-or-create. The old INSERT had no lookup and
    //     guardians are (correctly) not covered by any one-per-account unique
    //     index — two parents per account are legitimate — so a double-tap
    //     produced two rows for one human with distinct ids, which
    //     volunteer_signups_live_idx cannot collapse. One person could then
    //     hold two seats in the same slot.
    //
    // Never writes back to the source guardian_* columns: those are waiver
    // evidence for a specific athlete and season, this row is an operational
    // record of a person who works shifts (D3).
    const { data: guardianId, error: guardianError } = await supabase.rpc(
      "create_guardian_profile",
      { p_seeded_from: selection.seededFrom }
    );

    if (guardianError || !guardianId) {
      // The RPC's raises are all "this candidate was never claimable"
      // conditions (not your profile, no name, no phone on file) — the
      // picker already filters those out (candidatesFor() drops a phantom
      // with no guardian_phone), so reaching here means a stale candidate
      // list, not something the member can fix by reading the raw message.
      return {
        ok: false,
        error:
          "That guardian's record is incomplete. Refresh the page, or use \"Someone else…\" instead.",
      };
    }
    attendeeId = guardianId as string;
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

// The same shape as markVolunteerSeen(), for the "your shift was cancelled"
// badge, and called from /member/volunteer/mine — the page that actually shows
// the cancellations.
//
// A SEPARATE column from volunteer_last_seen_at on purpose. Browsing the list
// of open requests must not silently dismiss a notice that the club took a
// shift away from you; those are different events and they are marked seen by
// different pages.
//
// Best-effort, and it discards its own error exactly as markVolunteerSeen()
// does, for the same reason: a failure here must not stop the member from
// reading the very list they came for. The cost is that a broken write is
// invisible in the app — which is why the migration's post-apply checklist
// asks for a real-session UPDATE of this column specifically.
export async function markVolunteerCancellationsSeen(): Promise<void> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("account_settings")
    .update({ volunteer_cancellations_seen_at: new Date().toISOString() })
    .eq("id", user.id);
}

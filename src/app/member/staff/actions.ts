"use server";

import { createSessionClient } from "@/lib/supabase-server";
import { assertRole } from "@/lib/roles";
import { MEMBERSHIP_SEASON } from "@/lib/member-types";
import {
  validateEventDraft,
  validateSlots,
  publishBlockedReason,
} from "@/lib/volunteer/event-validation";
import { combineDateTime, effectiveSlotDate } from "@/lib/volunteer/datetime";
import { SLOT_CANCEL_ACTION_LABEL } from "@/lib/volunteer/cancellations";
import type { EventDraft, VolunteerSlotDraft } from "@/lib/volunteer/types";

type ActionResult = { ok: boolean; error?: string };

// Every action below starts with assertRole("coach") — the layout at
// src/app/member/staff/layout.tsx is UX only; this call is the real
// boundary, and RLS on events/volunteer_slots behind it is the final one.
// See VOLUNTEERS.md, "Routes and file layout." None of these actions ever
// touch `profiles` or `account_settings`, and none send email.

// `event` resolves the slot's actual day via effectiveSlotDate — for a
// single-day event this overrides whatever's on the slot draft (which can
// be blank, e.g. right after "Duplicate event") with the event's own day.
// Must use the exact same resolution the client-side validation in
// event-validation.ts uses, or a slot could pass validation against one
// date and be written with another.
function slotPayload(
  slot: VolunteerSlotDraft,
  eventId: string,
  sortOrder: number,
  event: EventDraft
) {
  const date = effectiveSlotDate(slot.date, event.start_date, event.end_date);
  return {
    event_id: eventId,
    role_name: slot.role_name.trim(),
    notes: slot.notes.trim() || null,
    start_at: combineDateTime(date, slot.start_time),
    ends_at: combineDateTime(date, slot.end_time),
    capacity: parseInt(slot.capacity, 10),
    adults_only: slot.adults_only,
    sort_order: sortOrder,
  };
}

function validateForSave(data: EventDraft, slots: VolunteerSlotDraft[]): string | null {
  const eventErrors = validateEventDraft(data);
  const slotErrors = validateSlots(slots, data);
  if (Object.keys(eventErrors).length > 0 || Object.keys(slotErrors).length > 0) {
    return "Please fix the highlighted fields before saving.";
  }
  return null;
}

// Always creates a draft (published: false, hard-coded — never taken from
// the client payload). "Create & Publish" on the new-event page is a client-
// side sequence of createEvent() followed by publishEvent(), not a flag on
// this action — that way the "at least one slot" check and the one-way
// publish mechanism live in exactly one place (publishEvent).
export async function createEvent(
  data: EventDraft,
  slots: VolunteerSlotDraft[]
): Promise<ActionResult & { eventId?: string }> {
  await assertRole("coach");
  const supabase = await createSessionClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not authenticated. Please sign in again." };
  }

  const validationError = validateForSave(data, slots);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const startsAt = combineDateTime(data.start_date, data.start_time);
  if (!startsAt) {
    return { ok: false, error: "Enter a valid start date." };
  }

  const { data: inserted, error: eventError } = await supabase
    .from("events")
    .insert({
      title: data.title.trim(),
      description: data.description.trim() || null,
      location: data.location.trim() || null,
      starts_at: startsAt,
      ends_at: combineDateTime(data.end_date, data.end_time),
      season: MEMBERSHIP_SEASON,
      created_by: user.id,
      published: false,
    })
    .select("id")
    .single();

  if (eventError || !inserted) {
    return { ok: false, error: eventError?.message ?? "Could not create event." };
  }

  if (slots.length > 0) {
    const { error: slotsError } = await supabase
      .from("volunteer_slots")
      .insert(slots.map((s, i) => slotPayload(s, inserted.id, i, data)));

    // The event row already exists at this point even though slot insertion
    // failed — same sequential-writes tradeoff already accepted in
    // src/app/member/actions.ts (no cross-table transaction available
    // through the Supabase client). The coach lands back on a real,
    // re-editable draft event either way; nothing is silently lost.
    if (slotsError) {
      return { ok: false, error: slotsError.message, eventId: inserted.id };
    }
  }

  return { ok: true, eventId: inserted.id };
}

// Copy for updateEvent's signup guard below.
//
// HISTORY, because the previous version of this comment is now false and
// someone will otherwise re-derive it: this wording used to avoid deleteEvent's
// "cancel their signups first" instruction on the grounds that "there is no
// staff-side cancellation anywhere in the app." That was true when it was
// written. It is not true now — cancelSignupAsStaff/cancelSlotSignups below,
// and the controls on the event roster page, are exactly that cancellation.
// So this copy now points at the roster, which is a place a coach can actually
// go and a button they can actually press.
//
// The order of the two suggestions is deliberate and unchanged in spirit:
// keeping the slot is still the cheap, reversible option and is offered first;
// cancelling volunteers is the one that takes someone's committed shift away,
// so it comes second and is described as what it is. Names the slot and the
// headcount either way, so the coach knows which row to put back — or whose
// morning they are about to free up.
function claimedSlotRemovalError(claimed: { roleName: string; count: number }[]): string {
  const list = claimed
    .map((c) => `"${c.roleName}" (${c.count} ${c.count === 1 ? "volunteer" : "volunteers"} signed up)`)
    .join(", ");
  const plural = claimed.length > 1;
  return (
    `Nothing was saved. Removing ${list} would delete those signups outright. ` +
    `Add the ${plural ? "slots" : "slot"} back to the form and save again — you can still rename ` +
    `${plural ? "them" : "it"} or change the time, capacity, or notes. If ` +
    `${plural ? "they really have" : "it really has"} to go, open this event's roster, use ` +
    `"${SLOT_CANCEL_ACTION_LABEL}" there, then remove the ` +
    `${plural ? "slots" : "slot"} here. No email goes out — message ` +
    `${plural ? "those volunteers" : "that volunteer"} yourself.`
  );
}

// Staff-side cancellation. Separate RPCs from the member's own cancelSignup
// (src/app/member/volunteer/actions.ts): that one answers "is this your
// signup?", these answer "are you staff?", and only these write the
// attribution and reason that make a cancellation visible to the volunteer on
// their own dashboard. See the migration header for why the two authorization
// models are deliberately not merged into one function.
//
// NO EMAIL IS SENT by either of these, and the roster UI says so at the point
// of action. The reason text is the only explanation the volunteer ever gets,
// which is why a blank one is refused here AND in the database.
//
// assertRole("coach") is the same UX-level gate every action in this file
// uses; the RPC's own has_role_at_least('coach') is the real boundary.

function blankReasonError(): string {
  return "Enter a reason. The volunteer sees this on their dashboard — it's the only notice they get.";
}

export async function cancelSignupAsStaff(
  signupId: string,
  reason: string
): Promise<ActionResult> {
  await assertRole("coach");

  // Checked here purely so the coach reads a sentence instead of a raw
  // Postgres message. The database refuses a blank reason too, and that is the
  // check that actually binds — PostgREST is reachable directly.
  if (!reason.trim()) {
    return { ok: false, error: blankReasonError() };
  }

  const supabase = await createSessionClient();

  // The RPC returns boolean (true = cancelled now, false = already cancelled)
  // and RAISEs for "no such row" / "not authorized". Both boolean outcomes are
  // success from the caller's point of view — a double-submit from a stale
  // roster page is the outcome the coach wanted, reached a moment earlier —
  // mirroring publishEvent's treatment of an already-published event.
  const { error } = await supabase.rpc("staff_cancel_signup", {
    p_signup_id: signupId,
    p_reason: reason.trim(),
  });

  if (error) {
    return {
      ok: false,
      error: "That signup could not be cancelled. Reload the roster and try again.",
    };
  }

  return { ok: true };
}

// Clears every live signup on one slot in a single statement. Deliberately NOT
// a loop over cancelSignupAsStaff: there is no transaction available through
// the Supabase client (the same limitation createEvent/updateEvent document
// above), so a loop that failed part-way would leave a slot half-cleared, the
// coach's actual goal still blocked, and no way to tell which volunteers were
// dropped. One UPDATE inside the RPC is atomic by definition.
//
// `cancelled` is the number of people actually removed, so the caller can
// report it. Zero is a success — the slot was already empty.
export async function cancelSlotSignups(
  slotId: string,
  reason: string
): Promise<ActionResult & { cancelled?: number }> {
  await assertRole("coach");

  if (!reason.trim()) {
    return { ok: false, error: blankReasonError() };
  }

  const supabase = await createSessionClient();

  const { data, error } = await supabase.rpc("staff_cancel_slot_signups", {
    p_slot_id: slotId,
    p_reason: reason.trim(),
  });

  if (error) {
    return {
      ok: false,
      error: "Those signups could not be cancelled. Reload the roster and try again.",
    };
  }

  return { ok: true, cancelled: (data as number | null) ?? 0 };
}

// Editable fields only — `published`/`published_at` are never part of this
// payload, so this action structurally cannot publish or un-publish an
// event. publishEvent() below is the only path that flips `published`.
export async function updateEvent(
  eventId: string,
  data: EventDraft,
  slots: VolunteerSlotDraft[]
): Promise<ActionResult> {
  await assertRole("coach");
  const supabase = await createSessionClient();

  const validationError = validateForSave(data, slots);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const startsAt = combineDateTime(data.start_date, data.start_time);
  if (!startsAt) {
    return { ok: false, error: "Enter a valid start date." };
  }

  // Reconcile slots against what's actually in the DB (never trust ids from
  // the client alone): delete rows dropped from the submission, update rows
  // that still exist, insert rows that arrived with no id.
  //
  // Read before any write. The signup guard below has to be able to refuse
  // the save without having already touched the events row — this function
  // has no transaction to roll back (see the note above the per-slot loop).
  const { data: existing, error: existingError } = await supabase
    .from("volunteer_slots")
    .select("id, role_name")
    .eq("event_id", eventId);

  if (existingError) {
    return { ok: false, error: existingError.message };
  }

  const existingSlots = (existing ?? []) as { id: string; role_name: string }[];
  const existingIds = new Set(existingSlots.map((s) => s.id));
  const submittedIds = new Set(
    slots.filter((s): s is VolunteerSlotDraft & { id: string } => s.id !== null).map((s) => s.id)
  );

  const toDelete = [...existingIds].filter((id) => !submittedIds.has(id));

  // volunteer_signups.slot_id is ON DELETE CASCADE, so deleting a slot row
  // hard-deletes every signup on it — bypassing the cancelled_at soft-delete
  // the rest of the system is built on, with no record left that the
  // commitment ever existed. deleteEvent() below guards the same hazard for
  // a whole event; this is the per-slot form of that check.
  //
  // Deliberately narrower than deleteEvent's blanket refusal: it fires only
  // when a slot someone has actually claimed is the thing being removed. A
  // coach fixing a typo in the title, or editing an unrelated slot, is never
  // blocked by a signup sitting somewhere else on the event.
  if (toDelete.length > 0) {
    const { data: liveSignups, error: signupsError } = await supabase
      .from("volunteer_signups")
      .select("slot_id")
      .in("slot_id", toDelete)
      .is("cancelled_at", null);

    if (signupsError) {
      return { ok: false, error: signupsError.message };
    }

    const liveBySlot = new Map<string, number>();
    for (const row of (liveSignups ?? []) as { slot_id: string }[]) {
      liveBySlot.set(row.slot_id, (liveBySlot.get(row.slot_id) ?? 0) + 1);
    }

    if (liveBySlot.size > 0) {
      const claimed = existingSlots
        .filter((s) => liveBySlot.has(s.id))
        .map((s) => ({ roleName: s.role_name, count: liveBySlot.get(s.id) as number }));
      return { ok: false, error: claimedSlotRemovalError(claimed) };
    }
  }

  // .select("id").maybeSingle(), matching setAccountRole in
  // src/app/member/staff/roles/actions.ts. Without it a bogus or
  // already-deleted eventId matches zero rows, PostgREST reports no error,
  // and the coach is told "Changes saved." when nothing was.
  const { data: updatedEvent, error: eventError } = await supabase
    .from("events")
    .update({
      title: data.title.trim(),
      description: data.description.trim() || null,
      location: data.location.trim() || null,
      starts_at: startsAt,
      ends_at: combineDateTime(data.end_date, data.end_time),
    })
    .eq("id", eventId)
    .select("id")
    .maybeSingle();

  if (eventError) {
    return { ok: false, error: eventError.message };
  }
  if (!updatedEvent) {
    return { ok: false, error: "That event no longer exists. Nothing was saved." };
  }

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("volunteer_slots")
      .delete()
      .in("id", toDelete);
    if (deleteError) return { ok: false, error: deleteError.message };
  }

  // Sequential per-slot writes with no surrounding transaction — same
  // tradeoff accepted in createEvent above. A failure part-way through
  // leaves the event row updated and some slots written; the coach lands
  // back on the form with an error and can re-save.
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const payload = slotPayload(slot, eventId, i, data);
    if (slot.id) {
      // `slot.id` came from the client. Without the membership check and the
      // event_id filter, a submitted id belonging to another event would be
      // re-parented onto this one by the update below — quietly removing that
      // slot, and its volunteers' signups, from the event they belong to.
      if (!existingIds.has(slot.id)) {
        return {
          ok: false,
          error: "One of these slots is no longer part of this event. Reload the page and try again.",
        };
      }
      const { error } = await supabase
        .from("volunteer_slots")
        .update(payload)
        .eq("id", slot.id)
        .eq("event_id", eventId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from("volunteer_slots").insert(payload);
      if (error) return { ok: false, error: error.message };
    }
  }

  return { ok: true };
}

// One-way publish. Re-checks slot count against the DB (never the client's
// in-memory list) so a stale form can't publish an event that lost its only
// slot in another tab. The `.eq("published", false)` on the write is both
// the race guard (two concurrent publishes can't double-fire) and the entire
// mechanism behind "publish is one-way" — no code path anywhere sets
// published back to false.
export async function publishEvent(eventId: string): Promise<ActionResult> {
  await assertRole("coach");
  const supabase = await createSessionClient();

  const { count, error: countError } = await supabase
    .from("volunteer_slots")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId);

  if (countError) {
    return { ok: false, error: countError.message };
  }

  const blockedReason = publishBlockedReason(count ?? 0);
  if (blockedReason) {
    return { ok: false, error: blockedReason };
  }

  const { error: publishError } = await supabase
    .from("events")
    .update({ published: true, published_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("published", false);

  // No rows matching (already published by a double-click, or by another
  // coach in another tab) is not an error — it's the outcome the coach
  // wanted, just reached a moment earlier. Surfacing that as a red error
  // would be confusing, not informative.
  if (publishError) {
    return { ok: false, error: publishError.message };
  }

  return { ok: true };
}

// M3 added volunteer_signups: a slot can now carry live commitments, so an
// unguarded delete could silently drop someone's plans with no notice. Check
// for any non-cancelled signup on any of this event's slots before deleting
// — volunteer_slots itself still cascade-deletes via its event_id foreign
// key, so no separate slot cleanup is needed once this check passes.
export async function deleteEvent(eventId: string): Promise<ActionResult> {
  await assertRole("coach");
  const supabase = await createSessionClient();

  const { data: slotRows, error: slotsError } = await supabase
    .from("volunteer_slots")
    .select("id")
    .eq("event_id", eventId);

  if (slotsError) {
    return { ok: false, error: slotsError.message };
  }

  const slotIds = (slotRows ?? []).map((s) => s.id as string);

  if (slotIds.length > 0) {
    const { count, error: signupsError } = await supabase
      .from("volunteer_signups")
      .select("*", { count: "exact", head: true })
      .in("slot_id", slotIds)
      .is("cancelled_at", null);

    if (signupsError) {
      return { ok: false, error: signupsError.message };
    }

    // This used to say "Cancel their signups before deleting it" with no way
    // to do that — there was no staff-side cancellation at all. There is now
    // (cancelSignupAsStaff / cancelSlotSignups above), so this points at the
    // screen that carries it.
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error:
          `This event has ${count} volunteer${count === 1 ? "" : "s"} signed up. Open this ` +
          `event's roster and use "${SLOT_CANCEL_ACTION_LABEL}" on each role, then delete the ` +
          `event. No email goes out — message them yourself first.`,
      };
    }
  }

  const { error } = await supabase.from("events").delete().eq("id", eventId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

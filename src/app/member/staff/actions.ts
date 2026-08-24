"use server";

import { createSessionClient } from "@/lib/supabase-server";
import { assertRole } from "@/lib/roles";
import { MEMBERSHIP_SEASON } from "@/lib/member-types";
import {
  validateEventDraft,
  validateSlots,
  publishBlockedReason,
} from "@/lib/volunteer/event-validation";
import { combineDateTime } from "@/lib/volunteer/datetime";
import type { EventDraft, VolunteerSlotDraft } from "@/lib/volunteer/types";

type ActionResult = { ok: boolean; error?: string };

// Every action below starts with assertRole("coach") — the layout at
// src/app/member/staff/layout.tsx is UX only; this call is the real
// boundary, and RLS on events/volunteer_slots behind it is the final one.
// See VOLUNTEERS.md, "Routes and file layout." None of these actions ever
// touch `profiles` or `account_settings`, and none send email.

function slotPayload(slot: VolunteerSlotDraft, eventId: string, sortOrder: number) {
  return {
    event_id: eventId,
    role_name: slot.role_name.trim(),
    notes: slot.notes.trim() || null,
    start_at: combineDateTime(slot.start_date, slot.start_time),
    ends_at: combineDateTime(slot.end_date, slot.end_time),
    capacity: parseInt(slot.capacity, 10),
    adults_only: slot.adults_only,
    sort_order: sortOrder,
  };
}

function validateForSave(data: EventDraft, slots: VolunteerSlotDraft[]): string | null {
  const eventErrors = validateEventDraft(data);
  const slotErrors = validateSlots(slots);
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
      .insert(slots.map((s, i) => slotPayload(s, inserted.id, i)));

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

  const { error: eventError } = await supabase
    .from("events")
    .update({
      title: data.title.trim(),
      description: data.description.trim() || null,
      location: data.location.trim() || null,
      starts_at: startsAt,
      ends_at: combineDateTime(data.end_date, data.end_time),
    })
    .eq("id", eventId);

  if (eventError) {
    return { ok: false, error: eventError.message };
  }

  // Reconcile slots against what's actually in the DB (never trust ids from
  // the client alone): delete rows dropped from the submission, update rows
  // that still exist, insert rows that arrived with no id.
  const { data: existing, error: existingError } = await supabase
    .from("volunteer_slots")
    .select("id")
    .eq("event_id", eventId);

  if (existingError) {
    return { ok: false, error: existingError.message };
  }

  const existingIds = new Set((existing ?? []).map((s) => s.id as string));
  const submittedIds = new Set(
    slots.filter((s): s is VolunteerSlotDraft & { id: string } => s.id !== null).map((s) => s.id)
  );

  const toDelete = [...existingIds].filter((id) => !submittedIds.has(id));
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("volunteer_slots")
      .delete()
      .in("id", toDelete);
    if (deleteError) return { ok: false, error: deleteError.message };
  }

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const payload = slotPayload(slot, eventId, i);
    if (slot.id) {
      const { error } = await supabase.from("volunteer_slots").update(payload).eq("id", slot.id);
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

    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: "This event has volunteers already signed up. Cancel their signups before deleting it.",
      };
    }
  }

  const { error } = await supabase.from("events").delete().eq("id", eventId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

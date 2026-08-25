// Shared event/slot validation. Mirrors the validateStep/validateXxx split in
// src/lib/membership-validation.ts: the client (EventForm/SlotEditor) runs
// these for instant inline feedback, and the server actions (actions.ts)
// re-run the same functions before writing, so a hand-crafted request can't
// skip a rule the UI would have caught.
import type { EventDraft, VolunteerSlotDraft } from "./types";
import { combineDateTime, effectiveSlotDate } from "./datetime";

export type EventErrors = Partial<Record<"title" | "starts_at" | "ends_at", string>>;
export type SlotErrors = Partial<
  Record<"role_name" | "capacity" | "start_time" | "end_time" | "timing", string>
>;

export const MIN_SLOTS_TO_PUBLISH = 1;

// Rules that must hold for ANY save, draft or published. No slot-count
// requirement here — a draft may have zero slots (locked decision: staff can
// block out a date before the roles are figured out).
export function validateEventDraft(data: EventDraft): EventErrors {
  const errs: EventErrors = {};
  if (!data.title.trim()) errs.title = "Title is required.";
  if (!data.start_date) errs.starts_at = "Start date is required.";

  // Mirrors the events table's own CHECK (ends_at IS NULL OR ends_at >=
  // starts_at) — catching it here means a coach sees "end must be after
  // start" instead of the raw Postgres constraint-violation message that
  // check produces.
  const startsAt = combineDateTime(data.start_date, data.start_time);
  const endsAt = combineDateTime(data.end_date, data.end_time);
  if (startsAt && endsAt && endsAt < startsAt) {
    errs.ends_at = "End date/time must be after the start.";
  }

  return errs;
}

// Per-row rules for a single slot. Applied to every non-deleted row on every
// save (draft or publish) — a half-filled row would otherwise surface as a
// raw database error (role_name is NOT NULL, capacity has a CHECK > 0) rather
// than a clear inline message.
//
// `event` is the parent EventDraft, needed for the timing check below. A
// slot's start/end has no database-level guarantee of falling inside its
// event's window — unlike a slot's own start<=end (a single-table CHECK on
// volunteer_slots), "within the parent event" spans two tables and Postgres
// CHECK constraints can't reference another table, so this rule can only
// live here (and in the identical server-side re-check in actions.ts) —
// there is no DB constraint backing it up. Coaches are the only role that
// can reach this write path at all (RLS + assertRole("coach")), so an
// app-only guard is an acceptable tradeoff here, unlike capacity or
// role_name which the DB also enforces.
export function validateSlot(slot: VolunteerSlotDraft, event: EventDraft): SlotErrors {
  const errs: SlotErrors = {};
  if (!slot.role_name.trim()) errs.role_name = "Role name is required.";
  const capacity = parseInt(slot.capacity, 10);
  if (!slot.capacity.trim() || isNaN(capacity) || capacity <= 0) {
    errs.capacity = "Capacity must be a positive number.";
  }

  // Required, like role_name/capacity above — a shift with no times isn't a
  // real slot. Also closes a real bug: combineDateTime() treats a blank
  // time as midnight (correct for the event's own optional time fields, an
  // all-day event has no specific start time), so an unset start_time was
  // silently resolving to 12:00 AM and then failing the "within the event's
  // window" check below with a confusing "starts before the event" message
  // instead of the actual problem, "no time was entered."
  if (!slot.start_time) errs.start_time = "Start time is required.";
  if (!slot.end_time) errs.end_time = "End time is required.";

  // Only run the timing cross-checks once both times are genuinely present
  // — otherwise this would double up with the required-field errors above
  // using that same midnight-default behavior.
  if (slot.start_time && slot.end_time) {
    // Slot start and end always share the same calendar day (see the
    // VolunteerSlotDraft type comment) — SlotEditor picks one `date` for
    // the whole slot, so there is only one field to read here, unlike the
    // event's own start_date/end_date pair. effectiveSlotDate resolves a
    // blank/stale `date` to the event's own day when the event only spans
    // one — see that function's comment for why a slot can't always be
    // trusted to have this set for itself (e.g. right after "Duplicate
    // event").
    const date = effectiveSlotDate(slot.date, event.start_date, event.end_date);
    const slotStart = combineDateTime(date, slot.start_time);
    const slotEnd = combineDateTime(date, slot.end_time);

    if (slotStart && slotEnd && slotEnd < slotStart) {
      errs.timing = "End time must be after the start time.";
    } else {
      const eventStart = combineDateTime(event.start_date, event.start_time);
      const eventEnd = combineDateTime(event.end_date, event.end_time);

      if (slotStart && eventStart && slotStart < eventStart) {
        errs.timing = "This slot starts before the event does.";
      } else if (slotStart && eventEnd && slotStart > eventEnd) {
        errs.timing = "This slot starts after the event ends.";
      } else if (slotEnd && eventEnd && slotEnd > eventEnd) {
        errs.timing = "This slot ends after the event does.";
      } else if (slotEnd && eventStart && slotEnd < eventStart) {
        errs.timing = "This slot ends before the event starts.";
      }
    }
  }

  return errs;
}

export function validateSlots(
  slots: VolunteerSlotDraft[],
  event: EventDraft
): Record<string, SlotErrors> {
  const errors: Record<string, SlotErrors> = {};
  for (const slot of slots) {
    const slotErrs = validateSlot(slot, event);
    if (Object.keys(slotErrs).length > 0) errors[slot.tempId] = slotErrs;
  }
  return errors;
}

// The additional rule that only applies when publishing (or using "Create &
// Publish"): at least one slot. Message text lives in exactly one place so
// the client's inline check and the server's re-check can't drift.
export function publishBlockedReason(slotCount: number): string | null {
  return slotCount < MIN_SLOTS_TO_PUBLISH
    ? "Add at least one slot before publishing."
    : null;
}

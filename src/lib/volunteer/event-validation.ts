// Shared event/slot validation. Mirrors the validateStep/validateXxx split in
// src/lib/membership-validation.ts: the client (EventForm/SlotEditor) runs
// these for instant inline feedback, and the server actions (actions.ts)
// re-run the same functions before writing, so a hand-crafted request can't
// skip a rule the UI would have caught.
import type { EventDraft, VolunteerSlotDraft } from "./types";

export type EventErrors = Partial<Record<"title" | "starts_at", string>>;
export type SlotErrors = Partial<Record<"role_name" | "capacity", string>>;

export const MIN_SLOTS_TO_PUBLISH = 1;

// Rules that must hold for ANY save, draft or published. No slot-count
// requirement here — a draft may have zero slots (locked decision: staff can
// block out a date before the roles are figured out).
export function validateEventDraft(data: EventDraft): EventErrors {
  const errs: EventErrors = {};
  if (!data.title.trim()) errs.title = "Title is required.";
  if (!data.start_date) errs.starts_at = "Start date is required.";
  return errs;
}

// Per-row rules for a single slot. Applied to every non-deleted row on every
// save (draft or publish) — a half-filled row would otherwise surface as a
// raw database error (role_name is NOT NULL, capacity has a CHECK > 0) rather
// than a clear inline message.
export function validateSlot(slot: VolunteerSlotDraft): SlotErrors {
  const errs: SlotErrors = {};
  if (!slot.role_name.trim()) errs.role_name = "Role name is required.";
  const capacity = parseInt(slot.capacity, 10);
  if (!slot.capacity.trim() || isNaN(capacity) || capacity <= 0) {
    errs.capacity = "Capacity must be a positive number.";
  }
  return errs;
}

export function validateSlots(slots: VolunteerSlotDraft[]): Record<string, SlotErrors> {
  const errors: Record<string, SlotErrors> = {};
  for (const slot of slots) {
    const slotErrs = validateSlot(slot);
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

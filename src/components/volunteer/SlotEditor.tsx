"use client";

import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { newSlotDraft, type VolunteerSlotDraft } from "@/lib/volunteer/types";
import type { SlotErrors } from "@/lib/volunteer/event-validation";

// Add/remove/edit slot rows for an event. Genuinely new interface — nothing
// else in the codebase lets a coach click "+" to add a blank, freely-typed
// row (the closest precedent, ObservationForm's session picker, only ever
// removes items chosen from a calendar). State lives in the parent
// EventForm, not here, since Save Draft/Publish submit the whole slot list
// alongside the event fields in one server action call.
export function SlotEditor({
  slots,
  onChange,
  errors = {},
}: {
  slots: VolunteerSlotDraft[];
  onChange: (slots: VolunteerSlotDraft[]) => void;
  errors?: Record<string, SlotErrors>;
}) {
  function updateSlot(tempId: string, patch: Partial<VolunteerSlotDraft>) {
    onChange(slots.map((s) => (s.tempId === tempId ? { ...s, ...patch } : s)));
  }

  function removeSlot(tempId: string) {
    onChange(slots.filter((s) => s.tempId !== tempId));
  }

  return (
    <div className="flex flex-col gap-6">
      {slots.map((slot, i) => {
        const slotErrors = errors[slot.tempId] ?? {};
        return (
          <div
            key={slot.tempId}
            className="border border-rule p-5 rounded-sm flex flex-col gap-4"
          >
            <div className="flex items-start justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
                Slot {i + 1}
              </p>
              <button
                type="button"
                onClick={() => removeSlot(slot.tempId)}
                className="text-sm text-red-700 hover:text-red-900 underline transition-colors"
              >
                Remove
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                id={`slot-role-${slot.tempId}`}
                label="Role name"
                required
                value={slot.role_name}
                onChange={(v) => updateSlot(slot.tempId, { role_name: v })}
                error={slotErrors.role_name}
                placeholder="e.g. Armory, Check-in"
              />
              <TextField
                id={`slot-capacity-${slot.tempId}`}
                label="Capacity"
                type="number"
                required
                value={slot.capacity}
                onChange={(v) => updateSlot(slot.tempId, { capacity: v })}
                error={slotErrors.capacity}
              />
            </div>

            <TextField
              id={`slot-notes-${slot.tempId}`}
              label="Notes"
              value={slot.notes}
              onChange={(v) => updateSlot(slot.tempId, { notes: v })}
              placeholder="Optional"
              hint="Visible to volunteers once members can sign up."
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <TextField
                id={`slot-start-date-${slot.tempId}`}
                label="Start date"
                type="date"
                value={slot.start_date}
                onChange={(v) => updateSlot(slot.tempId, { start_date: v })}
              />
              <TextField
                id={`slot-start-time-${slot.tempId}`}
                label="Start time"
                type="time"
                value={slot.start_time}
                onChange={(v) => updateSlot(slot.tempId, { start_time: v })}
              />
              <TextField
                id={`slot-end-date-${slot.tempId}`}
                label="End date"
                type="date"
                value={slot.end_date}
                onChange={(v) => updateSlot(slot.tempId, { end_date: v })}
              />
              <TextField
                id={`slot-end-time-${slot.tempId}`}
                label="End time"
                type="time"
                value={slot.end_time}
                onChange={(v) => updateSlot(slot.tempId, { end_time: v })}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={slot.adults_only}
                onChange={(e) => updateSlot(slot.tempId, { adults_only: e.target.checked })}
                className="h-4 w-4"
              />
              Adults only
            </label>
          </div>
        );
      })}

      <Button
        as="button"
        type="button"
        variant="secondary"
        arrow="none"
        onClick={() => onChange([...slots, newSlotDraft()])}
        className="self-start"
      >
        <span aria-hidden="true" className="text-brass text-base leading-none">
          +
        </span>
        Add slot
      </Button>
    </div>
  );
}

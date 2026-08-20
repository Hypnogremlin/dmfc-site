"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/TextField";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Button } from "@/components/Button";
import { SlotEditor } from "@/components/volunteer/SlotEditor";
import {
  validateEventDraft,
  validateSlots,
  publishBlockedReason,
  type EventErrors,
  type SlotErrors,
} from "@/lib/volunteer/event-validation";
import type { EventDraft, VolunteerSlotDraft } from "@/lib/volunteer/types";
import { createEvent, updateEvent, publishEvent, deleteEvent } from "../actions";

const emptyDraft: EventDraft = {
  title: "",
  description: "",
  location: "",
  start_date: "",
  start_time: "",
  end_date: "",
  end_time: "",
};

const PUBLISH_CONFIRM_TEXT = "This can't be undone — the event will go live.";

// Shared by the new-event and edit-event pages. Create mode offers "Save
// draft" and "Create & publish" side by side; edit mode offers "Save
// changes", "Publish" (hidden once the event is already published, since
// publish is one-way), and "Delete". Publish and delete both go through
// ConfirmButton's two-step confirm — both are irreversible, not just delete.
export function EventForm({
  mode,
  eventId,
  initialEvent,
  initialSlots = [],
  published = false,
}: {
  mode: "create" | "edit";
  eventId?: string;
  initialEvent?: EventDraft;
  initialSlots?: VolunteerSlotDraft[];
  published?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<EventDraft>(initialEvent ?? emptyDraft);
  const [slots, setSlots] = useState<VolunteerSlotDraft[]>(initialSlots);
  const [eventErrors, setEventErrors] = useState<EventErrors>({});
  const [slotErrors, setSlotErrors] = useState<Record<string, SlotErrors>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function field<K extends keyof EventDraft>(key: K) {
    return (v: string) => setData((d) => ({ ...d, [key]: v }));
  }

  // Shared by both Save and Publish paths; `requireSlot` adds the
  // publish-only "at least one slot" rule so the message text lives in one
  // place (publishBlockedReason) for both the client check here and the
  // server's re-check in actions.ts.
  function runValidation(requireSlot: boolean): boolean {
    const ee = validateEventDraft(data);
    const se = validateSlots(slots);
    setEventErrors(ee);
    setSlotErrors(se);

    if (Object.keys(ee).length > 0 || Object.keys(se).length > 0) {
      setFormError(
        requireSlot
          ? "Please fix the highlighted fields before publishing."
          : "Please fix the highlighted fields before saving."
      );
      return false;
    }

    if (requireSlot) {
      const blocked = publishBlockedReason(slots.length);
      if (blocked) {
        setFormError(blocked);
        return false;
      }
    }

    setFormError(null);
    return true;
  }

  function handleSaveDraft() {
    setSavedMessage(null);
    if (!runValidation(false)) return;

    startTransition(async () => {
      if (mode === "create") {
        const result = await createEvent(data, slots);
        if (result.ok) {
          router.push("/member/staff/events");
        } else {
          setFormError(result.error ?? "Could not save the event.");
        }
      } else if (eventId) {
        const result = await updateEvent(eventId, data, slots);
        if (result.ok) {
          setSavedMessage("Changes saved.");
        } else {
          setFormError(result.error ?? "Could not save the event.");
        }
      }
    });
  }

  function handleCreateAndPublish() {
    setSavedMessage(null);
    if (!runValidation(true)) return;

    startTransition(async () => {
      const created = await createEvent(data, slots);
      if (!created.ok || !created.eventId) {
        setFormError(created.error ?? "Could not create the event.");
        return;
      }
      const publishResult = await publishEvent(created.eventId);
      if (!publishResult.ok) {
        setFormError(
          publishResult.error ??
            "The event was saved as a draft, but publishing failed. Open it from the events list to try again."
        );
        return;
      }
      router.push("/member/staff/events");
    });
  }

  function handlePublish() {
    setSavedMessage(null);
    if (!eventId) return;
    if (!runValidation(true)) return;

    startTransition(async () => {
      const result = await publishEvent(eventId);
      if (result.ok) {
        router.push("/member/staff/events");
      } else {
        setFormError(result.error ?? "Could not publish the event.");
      }
    });
  }

  function handleDelete() {
    if (!eventId) return;
    startTransition(async () => {
      const result = await deleteEvent(eventId);
      if (result.ok) {
        router.push("/member/staff/events");
      } else {
        setFormError(result.error ?? "Could not delete the event.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-6">
        <TextField
          id="title"
          label="Title"
          required
          value={data.title}
          onChange={field("title")}
          error={eventErrors.title}
        />
        <TextField id="location" label="Location" value={data.location} onChange={field("location")} />
        <TextField
          id="description"
          label="Description"
          value={data.description}
          onChange={field("description")}
          hint="Optional"
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <TextField
            id="start_date"
            label="Start date"
            type="date"
            required
            value={data.start_date}
            onChange={field("start_date")}
            error={eventErrors.starts_at}
          />
          <TextField
            id="start_time"
            label="Start time"
            type="time"
            value={data.start_time}
            onChange={field("start_time")}
          />
          <TextField id="end_date" label="End date" type="date" value={data.end_date} onChange={field("end_date")} />
          <TextField id="end_time" label="End time" type="time" value={data.end_time} onChange={field("end_time")} />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-ink mb-4">Volunteer slots</h2>
        <SlotEditor slots={slots} onChange={setSlots} errors={slotErrors} />
      </div>

      {formError && (
        <p className="text-sm text-red-700" role="alert" aria-live="polite">
          {formError}
        </p>
      )}
      {savedMessage && !formError && <p className="text-sm text-mute">{savedMessage}</p>}

      <div className="flex items-center gap-4 flex-wrap pt-6 border-t border-rule">
        <Button
          as="button"
          type="button"
          variant="secondary"
          arrow="none"
          disabled={isPending}
          onClick={handleSaveDraft}
        >
          {mode === "create" ? "Save draft" : "Save changes"}
        </Button>

        {mode === "create" && (
          <ConfirmButton
            label="Create & publish"
            confirmLabel="Yes, publish"
            confirmText={PUBLISH_CONFIRM_TEXT}
            onConfirm={handleCreateAndPublish}
            variant="primary"
            disabled={isPending}
          />
        )}

        {mode === "edit" && !published && (
          <ConfirmButton
            label="Publish"
            confirmLabel="Yes, publish"
            confirmText={PUBLISH_CONFIRM_TEXT}
            onConfirm={handlePublish}
            variant="primary"
            disabled={isPending}
          />
        )}

        {mode === "edit" && (
          <ConfirmButton
            label="Delete event"
            confirmLabel="Yes, delete"
            confirmText="This can't be undone."
            onConfirm={handleDelete}
            disabled={isPending}
          />
        )}
      </div>
    </div>
  );
}

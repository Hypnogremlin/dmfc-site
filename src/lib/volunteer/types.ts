// Hand-typed row shapes for the staff CRUD surface (M2). No generated
// Supabase types file exists in this repo (see src/lib/member-types.ts for
// the same hand-typed convention) — these mirror the columns added by
// supabase/migrations/20260820_volunteer_staff_crud.sql.

import { splitDateTime } from "./datetime";

export type VolunteerEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  season: string;
  created_by: string;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type VolunteerSlot = {
  id: string;
  event_id: string;
  role_name: string;
  notes: string | null;
  start_at: string | null;
  ends_at: string | null;
  capacity: number;
  adults_only: boolean;
  sort_order: number;
  created_at: string;
};

// Form-local shape for a slot row that may not be saved yet. `id` is null
// until the row exists in the DB; `tempId` is always present and stable, so
// React has a key before a real id is assigned and EventForm/SlotEditor can
// tell "existing row" from "newly added row" when reconciling on save (see
// actions.ts). Date/time/capacity are kept as separate controlled-input
// strings — combined into timestamptz/number only at submit time, via
// src/lib/volunteer/datetime.ts.
export type VolunteerSlotDraft = {
  id: string | null;
  tempId: string;
  role_name: string;
  notes: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  capacity: string;
  adults_only: boolean;
};

export type EventDraft = {
  title: string;
  description: string;
  location: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
};

export function newSlotDraft(): VolunteerSlotDraft {
  return {
    id: null,
    tempId: crypto.randomUUID(),
    role_name: "",
    notes: "",
    start_date: "",
    start_time: "",
    end_date: "",
    end_time: "",
    capacity: "1",
    adults_only: false,
  };
}

export function slotToDraft(slot: VolunteerSlot): VolunteerSlotDraft {
  const start = splitDateTime(slot.start_at);
  const end = splitDateTime(slot.ends_at);
  return {
    id: slot.id,
    tempId: slot.id,
    role_name: slot.role_name,
    notes: slot.notes ?? "",
    start_date: start.date,
    start_time: start.time,
    end_date: end.date,
    end_time: end.time,
    capacity: String(slot.capacity),
    adults_only: slot.adults_only,
  };
}

export function eventToDraft(event: VolunteerEvent): EventDraft {
  const start = splitDateTime(event.starts_at);
  const end = splitDateTime(event.ends_at);
  return {
    title: event.title,
    description: event.description ?? "",
    location: event.location ?? "",
    start_date: start.date,
    start_time: start.time,
    end_date: end.date,
    end_time: end.time,
  };
}

// "Duplicate event" pre-fill (see VOLUNTEERS.md M2 decisions). Unlike
// eventToDraft/slotToDraft, these deliberately drop the source's dates/times
// — a copied event is for a different occasion, so carrying over the old
// date would just be something the coach has to remember to clear. Content
// (title/location/description, and each slot's role/notes/capacity/
// adults_only) carries over; ids do not, so submitting always creates new
// rows regardless of the source event's id or published state.
export function duplicateEventDraft(
  source: Pick<VolunteerEvent, "title" | "description" | "location">
): EventDraft {
  return {
    title: source.title,
    description: source.description ?? "",
    location: source.location ?? "",
    start_date: "",
    start_time: "",
    end_date: "",
    end_time: "",
  };
}

export function duplicateSlotDraft(
  source: Pick<VolunteerSlot, "role_name" | "notes" | "capacity" | "adults_only">
): VolunteerSlotDraft {
  return {
    id: null,
    tempId: crypto.randomUUID(),
    role_name: source.role_name,
    notes: source.notes ?? "",
    start_date: "",
    start_time: "",
    end_date: "",
    end_time: "",
    capacity: String(source.capacity),
    adults_only: source.adults_only,
  };
}

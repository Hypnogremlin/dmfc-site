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

// M3. `attended`/`credited_hours` are schema-complete but unused until M4 —
// nothing in this milestone writes to them (see the M3 migration header).
export type VolunteerSignup = {
  id: string;
  slot_id: string;
  account_id: string;
  attendee_profile_id: string | null;
  attendee_name: string | null;
  credit_profile_id: string | null;
  attended: boolean | null;
  credited_hours: number | null;
  notes: string | null;
  created_at: string;
  cancelled_at: string | null;
};

// Form-local shape for a slot row that may not be saved yet. `id` is null
// until the row exists in the DB; `tempId` is always present and stable, so
// React has a key before a real id is assigned and EventForm/SlotEditor can
// tell "existing row" from "newly added row" when reconciling on save (see
// actions.ts). Date/time/capacity are kept as separate controlled-input
// strings — combined into timestamptz/number only at submit time, via
// src/lib/volunteer/datetime.ts.
//
// A single `date` field, not separate start_date/end_date — a volunteer
// shift is a role worked on one calendar day, and it must fall within its
// parent event's own date range (enforced in event-validation.ts), so
// SlotEditor picks this from the small set of days the event actually
// spans rather than asking the coach to fill out a full date picker per
// slot (owner decision, 2026-08-24 — tournaments can have a dozen-plus
// slots, and re-entering the same one or two dates that many times was the
// friction being solved). If an event spans only one day, SlotEditor skips
// the day picker entirely and this is set to that day automatically.
export type VolunteerSlotDraft = {
  id: string | null;
  tempId: string;
  role_name: string;
  notes: string;
  date: string;
  start_time: string;
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

// `date` defaults to the caller-supplied event day when known (EventForm
// passes the event's first day so a coach adding slots one after another
// isn't reselecting the same date every time), and to "" otherwise.
export function newSlotDraft(date: string = ""): VolunteerSlotDraft {
  return {
    id: null,
    tempId: crypto.randomUUID(),
    role_name: "",
    notes: "",
    date,
    start_time: "",
    end_time: "",
    capacity: "1",
    adults_only: false,
  };
}

// Assumes start_at and ends_at fall on the same calendar day (true for
// everything written through this UI going forward — see the type comment
// above). If a row somehow has them on different days, `date` is taken from
// start_at and ends_at's own date component is silently discarded, keeping
// only its time-of-day; re-saving the slot would then normalize it onto a
// single day.
export function slotToDraft(slot: VolunteerSlot): VolunteerSlotDraft {
  const start = splitDateTime(slot.start_at);
  const end = splitDateTime(slot.ends_at);
  return {
    id: slot.id,
    tempId: slot.id,
    role_name: slot.role_name,
    notes: slot.notes ?? "",
    date: start.date,
    start_time: start.time,
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
    date: "",
    start_time: "",
    end_time: "",
    capacity: String(source.capacity),
    adults_only: source.adults_only,
  };
}

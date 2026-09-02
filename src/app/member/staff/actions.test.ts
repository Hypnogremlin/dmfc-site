import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventDraft, VolunteerSlotDraft } from "@/lib/volunteer/types";

// updateEvent's slot reconciliation is the one place in the staff surface
// that can destroy a member's live commitment: volunteer_signups.slot_id is
// ON DELETE CASCADE, so deleting a slot row hard-deletes the signups on it,
// bypassing the cancelled_at soft-delete everything else relies on. These
// tests pin the guard that stops that, plus the two adjacent defects fixed
// alongside it (client-supplied slot ids, and "Changes saved." on a write
// that matched zero rows).
//
// The Supabase client is faked rather than hit for real — there is no test
// database in this repo, and what is being asserted is the *sequence of
// statements this action issues*, which a fake records exactly.

vi.mock("@/lib/roles", () => ({ assertRole: vi.fn(async () => undefined) }));

const createSessionClient = vi.fn();
vi.mock("@/lib/supabase-server", () => ({
  createSessionClient: () => createSessionClient(),
}));

const { updateEvent, deleteEvent, cancelSignupAsStaff, cancelSlotSignups } = await import(
  "./actions"
);
const { cancelSignup } = await import("@/app/member/volunteer/actions");
const { SLOT_CANCEL_ACTION_LABEL } = await import("@/lib/volunteer/cancellations");

type Call = {
  table: string;
  op: "select" | "insert" | "update" | "delete" | "rpc";
  filters: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

type Result = { data?: unknown; error?: { message: string } | null; count?: number };

// A chainable, thenable stand-in for PostgREST's query builder. Every filter
// method records itself and returns `this`; awaiting the builder (or calling
// .maybeSingle()/.single()) hands the recorded call to `handler`, which the
// individual test uses to decide what the database "contains."
function makeClient(handler: (call: Call) => Result, calls: Call[]) {
  function builder(table: string, op: Call["op"], payload?: Record<string, unknown>) {
    const call: Call = { table, op, filters: {}, payload };
    // `count` is passed through for the head-count queries deleteEvent uses
    // (`.select("*", { count: "exact", head: true })`) — without it those
    // always read as zero and the guard under test never fires.
    const settle = () => {
      calls.push(call);
      const r = handler(call);
      return Promise.resolve({
        data: r.data ?? null,
        error: r.error ?? null,
        count: r.count ?? null,
      });
    };
    const self = {
      select: () => self,
      eq: (col: string, val: unknown) => {
        call.filters[col] = val;
        return self;
      },
      in: (col: string, val: unknown) => {
        call.filters[col] = val;
        return self;
      },
      is: (col: string, val: unknown) => {
        call.filters[col] = val;
        return self;
      },
      maybeSingle: settle,
      single: settle,
      then: (
        resolve: (v: { data: unknown; error: unknown }) => unknown,
        reject?: (e: unknown) => unknown
      ) => settle().then(resolve, reject),
    };
    return self;
  }

  return {
    from: (table: string) => ({
      select: () => builder(table, "select"),
      insert: (payload: Record<string, unknown>) => builder(table, "insert", payload),
      update: (payload: Record<string, unknown>) => builder(table, "update", payload),
      delete: () => builder(table, "delete"),
    }),
    // The cancellation actions go through SECURITY DEFINER RPCs rather than
    // table writes, so the fake needs an rpc() too. Recorded in the same
    // `calls` array (op "rpc", `table` = the function name) so a test can
    // assert both which function was called and that no OTHER one was.
    rpc: (fn: string, args: Record<string, unknown>) => {
      const call: Call = { table: fn, op: "rpc", filters: {}, payload: args };
      calls.push(call);
      const r = handler(call);
      return Promise.resolve({ data: r.data ?? null, error: r.error ?? null });
    },
  };
}

const EVENT_ID = "11111111-1111-1111-1111-111111111111";
const SLOT_KEPT = "22222222-2222-2222-2222-222222222222";
const SLOT_DROPPED = "33333333-3333-3333-3333-333333333333";
const FOREIGN_SLOT = "44444444-4444-4444-4444-444444444444";

const draft: EventDraft = {
  title: "Frostbite Open",
  description: "",
  location: "Des Moines",
  start_date: "2026-11-14",
  start_time: "09:00",
  end_date: "2026-11-14",
  end_time: "17:00",
};

function slotDraft(overrides: Partial<VolunteerSlotDraft> = {}): VolunteerSlotDraft {
  return {
    id: null,
    tempId: "temp-1",
    role_name: "Check-in table",
    notes: "",
    date: "2026-11-14",
    start_time: "09:00",
    end_time: "12:00",
    capacity: "2",
    adults_only: false,
    ...overrides,
  };
}

// Two slots live on the event; only SLOT_DROPPED is claimed.
function dbHandler(opts: { liveSignupSlotIds?: string[]; eventRowExists?: boolean } = {}) {
  const { liveSignupSlotIds = [], eventRowExists = true } = opts;
  return (call: Call): Result => {
    if (call.table === "volunteer_slots" && call.op === "select") {
      return {
        data: [
          { id: SLOT_KEPT, role_name: "Check-in table" },
          { id: SLOT_DROPPED, role_name: "Merch table" },
        ],
      };
    }
    if (call.table === "volunteer_signups") {
      const targets = (call.filters["slot_id"] as string[]) ?? [];
      return { data: liveSignupSlotIds.filter((id) => targets.includes(id)).map((id) => ({ slot_id: id })) };
    }
    if (call.table === "events" && call.op === "update") {
      return { data: eventRowExists ? { id: EVENT_ID } : null };
    }
    return { data: null };
  };
}

let calls: Call[];

function useDb(opts?: Parameters<typeof dbHandler>[0]) {
  calls = [];
  createSessionClient.mockResolvedValue(makeClient(dbHandler(opts), calls));
  return calls;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateEvent — live-signup guard on slot removal", () => {
  it("refuses, names the slot and headcount, and writes nothing when a claimed slot is dropped", async () => {
    useDb({ liveSignupSlotIds: [SLOT_DROPPED, SLOT_DROPPED] });

    const result = await updateEvent(EVENT_ID, draft, [
      slotDraft({ id: SLOT_KEPT, tempId: SLOT_KEPT }),
    ]);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('"Merch table"');
    expect(result.error).toContain("2 volunteers");
    // WHAT THIS ASSERTION IS FOR — read this before changing it.
    //
    // It used to be `expect(result.error).not.toMatch(/cancel/i)`, pinning
    // that this copy must not repeat deleteEvent's "cancel their signups
    // first" instruction. The invariant being protected was never "avoid the
    // word cancel" — it was "never tell a coach to do something no screen in
    // this app lets them do." Staff-side cancellation did not exist then, so
    // banning the word was a correct proxy for that.
    //
    // Staff-side cancellation exists now, so the proxy has inverted: the copy
    // SHOULD name it. The invariant is unchanged and is asserted directly
    // instead — the message must send the coach to a screen that exists (the
    // roster) and name a control that exists. Comparing against the same
    // exported constant the roster button renders means renaming that button
    // without fixing this copy fails here, rather than shipping a dead
    // instruction to a coach.
    expect(result.error).toMatch(/roster/i);
    expect(result.error).toContain(SLOT_CANCEL_ACTION_LABEL);
    // And it must still not imply a notification, because none is sent.
    expect(result.error).toMatch(/no email/i);

    // Nothing was written at all — not the event row, not the slots.
    expect(calls.filter((c) => c.op !== "select")).toHaveLength(0);
  });

  it("allows an unrelated edit while a signup exists on a slot that is being kept", async () => {
    useDb({ liveSignupSlotIds: [SLOT_KEPT] });

    const result = await updateEvent(EVENT_ID, { ...draft, title: "Frostbite Open (typo fixed)" }, [
      slotDraft({ id: SLOT_KEPT, tempId: SLOT_KEPT }),
      slotDraft({ id: SLOT_DROPPED, tempId: SLOT_DROPPED, role_name: "Merch table" }),
    ]);

    expect(result.ok).toBe(true);
    const eventWrite = calls.find((c) => c.table === "events" && c.op === "update");
    expect(eventWrite?.payload?.title).toBe("Frostbite Open (typo fixed)");
  });

  // The post-cancellation state. The coach used the roster control the error
  // above points them at, so the slot now has no LIVE signups — the rows still
  // exist, soft-cancelled, and the guard queries `.is("cancelled_at", null)`.
  // The removal that was refused must now go through; if it did not, the
  // instruction in that error would still be a dead end.
  it("permits the removal once the claimed slot's signups have been cancelled", async () => {
    useDb({ liveSignupSlotIds: [] });

    const result = await updateEvent(EVENT_ID, draft, [
      slotDraft({ id: SLOT_KEPT, tempId: SLOT_KEPT }),
    ]);

    expect(result.ok).toBe(true);
    const del = calls.find((c) => c.table === "volunteer_slots" && c.op === "delete");
    expect(del?.filters["id"]).toEqual([SLOT_DROPPED]);
  });

  it("still deletes a dropped slot that nobody has claimed", async () => {
    useDb({ liveSignupSlotIds: [] });

    const result = await updateEvent(EVENT_ID, draft, [
      slotDraft({ id: SLOT_KEPT, tempId: SLOT_KEPT }),
    ]);

    expect(result.ok).toBe(true);
    const del = calls.find((c) => c.table === "volunteer_slots" && c.op === "delete");
    expect(del?.filters["id"]).toEqual([SLOT_DROPPED]);
  });
});

describe("updateEvent — client-supplied slot ids", () => {
  it("refuses a slot id that does not belong to this event instead of re-parenting it", async () => {
    useDb();

    const result = await updateEvent(EVENT_ID, draft, [
      slotDraft({ id: SLOT_KEPT, tempId: SLOT_KEPT }),
      slotDraft({ id: SLOT_DROPPED, tempId: SLOT_DROPPED }),
      slotDraft({ id: FOREIGN_SLOT, tempId: FOREIGN_SLOT, role_name: "Someone else's slot" }),
    ]);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("no longer part of this event");
    const foreignWrite = calls.find(
      (c) => c.table === "volunteer_slots" && c.op === "update" && c.filters["id"] === FOREIGN_SLOT
    );
    expect(foreignWrite).toBeUndefined();
  });

  it("scopes every slot update to this event_id", async () => {
    useDb();

    await updateEvent(EVENT_ID, draft, [
      slotDraft({ id: SLOT_KEPT, tempId: SLOT_KEPT }),
      slotDraft({ id: SLOT_DROPPED, tempId: SLOT_DROPPED }),
    ]);

    const slotUpdates = calls.filter((c) => c.table === "volunteer_slots" && c.op === "update");
    expect(slotUpdates).toHaveLength(2);
    for (const c of slotUpdates) {
      expect(c.filters["event_id"]).toBe(EVENT_ID);
    }
  });
});

describe("updateEvent — zero-row event update", () => {
  it("reports failure rather than success when the event row matched nothing", async () => {
    useDb({ eventRowExists: false });

    const result = await updateEvent(EVENT_ID, draft, [
      slotDraft({ id: SLOT_KEPT, tempId: SLOT_KEPT }),
      slotDraft({ id: SLOT_DROPPED, tempId: SLOT_DROPPED }),
    ]);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("no longer exists");
  });
});

// ---------------------------------------------------------------------------
// Staff-side cancellation
// ---------------------------------------------------------------------------
// The database is the real enforcer of every rule below: staff_cancel_signup
// gates on has_role_at_least('coach'), RAISEs on a blank reason, and is what
// decides no-op vs. cancelled. What these tests pin is the action layer's half
// of the contract — that a blank reason never reaches the network at all, that
// an already-cancelled signup reads to the coach as success rather than as a
// red error, and, most of all, that the staff path and the member path stay
// two different functions.

const SIGNUP_ID = "55555555-5555-5555-5555-555555555555";
const SLOT_ID = "66666666-6666-6666-6666-666666666666";

// `rpcResults` maps a function name to what the fake returns for it; anything
// unlisted returns null with no error.
function useRpc(rpcResults: Record<string, Result> = {}) {
  calls = [];
  createSessionClient.mockResolvedValue(
    makeClient((call: Call) => (call.op === "rpc" ? rpcResults[call.table] ?? { data: null } : { data: null }), calls)
  );
  return calls;
}

// The member's cancelSignup calls supabase.auth.getUser() before its RPC; the
// staff actions do not. Bolted on here rather than in makeClient so the
// updateEvent tests above keep exactly the client they had.
function useRpcWithAuth() {
  calls = [];
  const client = makeClient(
    (call: Call) => (call.op === "rpc" ? { data: true } : { data: null }),
    calls
  ) as Record<string, unknown>;
  client.auth = { getUser: async () => ({ data: { user: { id: "user-1" } } }) };
  createSessionClient.mockResolvedValue(client);
  return calls;
}

describe("cancelSignupAsStaff", () => {
  it("refuses a blank reason without touching the database", async () => {
    useRpc();

    const result = await cancelSignupAsStaff(SIGNUP_ID, "   ");

    expect(result.ok).toBe(false);
    // The message has to say what the reason is FOR. A coach who reads it as
    // an internal note types "n/a" and the volunteer learns nothing — and
    // nothing else will ever tell them, since no email is sent.
    expect(result.error).toMatch(/reason/i);
    expect(result.error).toMatch(/dashboard/i);
    expect(calls).toHaveLength(0);
  });

  it("sends the trimmed reason to staff_cancel_signup", async () => {
    useRpc({ staff_cancel_signup: { data: true } });

    const result = await cancelSignupAsStaff(SIGNUP_ID, "  Tournament called off.  ");

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("staff_cancel_signup");
    expect(calls[0].payload).toEqual({
      p_signup_id: SIGNUP_ID,
      p_reason: "Tournament called off.",
    });
  });

  it("treats an already-cancelled signup as success, not an error", async () => {
    // `false` = the RPC found cancelled_at already set and did nothing, and
    // deliberately did not re-stamp the timestamp or reason. A double-submit
    // from a stale roster page is the outcome the coach wanted, reached a
    // moment earlier; showing red text would teach them to distrust a control
    // that worked.
    useRpc({ staff_cancel_signup: { data: false } });

    const result = await cancelSignupAsStaff(SIGNUP_ID, "Tournament called off.");

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("never routes a staff cancellation through the member RPC", async () => {
    useRpc({ staff_cancel_signup: { data: true } });

    await cancelSignupAsStaff(SIGNUP_ID, "Tournament called off.");

    // cancel_volunteer_signup writes neither cancelled_by nor
    // cancelled_reason, so a staff cancellation sent through it would be
    // invisible on the volunteer's dashboard — the exact failure this whole
    // feature exists to prevent.
    expect(calls.some((c) => c.table === "cancel_volunteer_signup")).toBe(false);
  });
});

describe("cancelSlotSignups", () => {
  it("refuses a blank reason without touching the database", async () => {
    useRpc();

    const result = await cancelSlotSignups(SLOT_ID, "\n\t ");

    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("clears the whole slot in ONE call and reports how many were cancelled", async () => {
    useRpc({ staff_cancel_slot_signups: { data: 3 } });

    const result = await cancelSlotSignups(SLOT_ID, "Event cancelled.");

    expect(result.ok).toBe(true);
    expect(result.cancelled).toBe(3);
    // One atomic statement, not a loop of per-signup calls: there is no
    // transaction available through the Supabase client, so a loop that failed
    // part-way would leave the slot half-cleared and the coach's actual goal
    // still blocked.
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("staff_cancel_slot_signups");
  });

  it("treats an already-empty slot as success", async () => {
    useRpc({ staff_cancel_slot_signups: { data: 0 } });

    const result = await cancelSlotSignups(SLOT_ID, "Event cancelled.");

    expect(result.ok).toBe(true);
    expect(result.cancelled).toBe(0);
  });
});

describe("the member's own cancel path is unchanged", () => {
  it("still calls cancel_volunteer_signup with only the signup id", async () => {
    useRpcWithAuth();

    const result = await cancelSignup(SIGNUP_ID);

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("cancel_volunteer_signup");
    // No reason, no attribution — and that absence is load-bearing. The /mine
    // page keys "the club cancelled this" off cancelled_reason being non-null,
    // so if the member path ever wrote one, a member's own cancellation would
    // render back to them as a club cancellation.
    expect(calls[0].payload).toEqual({ p_signup_id: SIGNUP_ID });
  });
});

describe("deleteEvent — the copy points at a control that exists", () => {
  it("names the roster and the slot-cancel action when live signups block the delete", async () => {
    calls = [];
    createSessionClient.mockResolvedValue(
      makeClient((call: Call): Result => {
        if (call.table === "volunteer_slots" && call.op === "select") {
          return { data: [{ id: SLOT_KEPT }] };
        }
        if (call.table === "volunteer_signups") {
          return { data: null, count: 2 };
        }
        return { data: null };
      }, calls)
    );

    const result = await deleteEvent(EVENT_ID);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/roster/i);
    expect(result.error).toContain(SLOT_CANCEL_ACTION_LABEL);
    expect(result.error).toMatch(/no email/i);
    expect(calls.some((c) => c.table === "events" && c.op === "delete")).toBe(false);
  });
});

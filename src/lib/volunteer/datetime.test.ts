import { afterEach, describe, expect, it, vi } from "vitest";
import {
  combineDateTime,
  datesInRange,
  effectiveSlotDate,
  formatClubDate,
  formatClubDateTime,
  formatClubTimeRange,
  splitDateTime,
  upcomingCutoffIso,
} from "./datetime";

// THE POINT OF THIS FILE: every assertion below must hold identically under
// `TZ=UTC` (what Vercel's Node runtime runs as) and under
// `TZ=America/Chicago` (what the developer's machine runs as). The original
// bug was invisible locally for exactly that reason — combineDateTime()
// parsed the coach's "9:00 AM" as *process-local* time, so a shift typed as
// 9am was stored as 09:00Z and rendered to members as 3 or 4 AM.
//
// Run both:
//   TZ=UTC npx vitest run
//   TZ=America/Chicago npx vitest run
//
// Nothing here may assert on a process-local value, and no test may call
// `new Date("...T...")` without a zone designator.

describe("combineDateTime", () => {
  it("stores a winter (CST) 9:00 AM as 15:00Z, not 09:00Z", () => {
    // January 6 is unambiguously CST (UTC-6).
    expect(combineDateTime("2026-01-06", "09:00")).toBe("2026-01-06T15:00:00.000Z");
  });

  it("stores a summer (CDT) 9:00 AM as 14:00Z", () => {
    // July 4 is unambiguously CDT (UTC-5) — this is the case a hard-coded
    // -06:00 offset would get wrong by an hour.
    expect(combineDateTime("2026-07-04", "09:00")).toBe("2026-07-04T14:00:00.000Z");
  });

  it("uses a different offset either side of the fall-back boundary", () => {
    // Same wall-clock time a month apart, straddling the 2026-11-01 02:00
    // fall-back (the first Sunday in November).
    const before = combineDateTime("2026-10-30", "09:00");
    const after = combineDateTime("2026-11-30", "09:00");
    expect(before).toBe("2026-10-30T14:00:00.000Z"); // CDT
    expect(after).toBe("2026-11-30T15:00:00.000Z"); // CST
    expect(before).not.toBe(after);
  });

  it("uses a different offset either side of the spring-forward boundary", () => {
    expect(combineDateTime("2026-03-01", "09:00")).toBe("2026-03-01T15:00:00.000Z"); // CST
    expect(combineDateTime("2026-04-01", "09:00")).toBe("2026-04-01T14:00:00.000Z"); // CDT
  });

  it("a late-evening shift lands on the following UTC day, which is correct", () => {
    // 8pm Central in January is 02:00Z the next morning. Formatters that
    // don't pin the zone are what made this look like an off-by-one-day bug;
    // the stored instant is right.
    expect(combineDateTime("2026-01-06", "20:00")).toBe("2026-01-07T02:00:00.000Z");
  });

  it("midnight is the start of the Chicago day, not the UTC day", () => {
    expect(combineDateTime("2026-01-06", "00:00")).toBe("2026-01-06T06:00:00.000Z");
  });

  it("defaults a blank time to midnight", () => {
    expect(combineDateTime("2026-01-06", "")).toBe(combineDateTime("2026-01-06", "00:00"));
  });

  it("returns null for a missing or malformed date", () => {
    expect(combineDateTime("", "09:00")).toBeNull();
    expect(combineDateTime("not-a-date", "09:00")).toBeNull();
    expect(combineDateTime("2026-1-6", "09:00")).toBeNull();
  });

  it("returns null for a calendar day that does not exist", () => {
    // `new Date()` rejected these before; Date.UTC would silently roll them
    // into the next month, so the range check has to be explicit.
    expect(combineDateTime("2026-02-31", "09:00")).toBeNull();
    expect(combineDateTime("2026-13-01", "09:00")).toBeNull();
  });

  it("returns null for a malformed time", () => {
    expect(combineDateTime("2026-01-06", "9am")).toBeNull();
    expect(combineDateTime("2026-01-06", "25:00")).toBeNull();
  });
});

describe("splitDateTime", () => {
  it("is the exact inverse of combineDateTime in winter", () => {
    const iso = combineDateTime("2026-01-06", "09:00")!;
    expect(splitDateTime(iso)).toEqual({ date: "2026-01-06", time: "09:00" });
  });

  it("is the exact inverse of combineDateTime in summer", () => {
    const iso = combineDateTime("2026-07-04", "09:00")!;
    expect(splitDateTime(iso)).toEqual({ date: "2026-07-04", time: "09:00" });
  });

  it("round-trips a late-evening shift back to the same calendar day", () => {
    // This is the one the naive implementation gets visibly wrong: the
    // stored instant is 2026-01-07T02:00Z, and a UTC-parsing edit form
    // reopens it as Jan 7, 2:00 AM.
    const iso = combineDateTime("2026-01-06", "20:00")!;
    expect(splitDateTime(iso)).toEqual({ date: "2026-01-06", time: "20:00" });
  });

  it("survives repeated open-and-save cycles without drifting", () => {
    let iso = combineDateTime("2026-06-15", "18:30")!;
    for (let i = 0; i < 5; i++) {
      const { date, time } = splitDateTime(iso);
      iso = combineDateTime(date, time)!;
    }
    expect(splitDateTime(iso)).toEqual({ date: "2026-06-15", time: "18:30" });
    expect(iso).toBe("2026-06-15T23:30:00.000Z");
  });

  it("renders a raw UTC timestamp in Chicago wall-clock", () => {
    expect(splitDateTime("2026-01-06T15:00:00.000Z")).toEqual({
      date: "2026-01-06",
      time: "09:00",
    });
  });

  it("returns empty strings for null or unparseable input", () => {
    expect(splitDateTime(null)).toEqual({ date: "", time: "" });
    expect(splitDateTime("nonsense")).toEqual({ date: "", time: "" });
  });
});

describe("club display formatters", () => {
  it("renders a stored instant in club time, not process time", () => {
    // 2026-01-07T02:00Z is 8pm on Jan 6 in Des Moines. A bare
    // toLocaleString on a UTC runtime prints "Jan 7, 2:00 AM" here, which is
    // both wrong and a hydration mismatch against the member's browser.
    expect(formatClubDateTime("2026-01-07T02:00:00.000Z")).toBe("Tue, Jan 6, 8:00 PM");
    expect(formatClubDate("2026-01-07T02:00:00.000Z")).toBe("Tue, Jan 6, 2026");
  });

  it("formats a slot's time range in club time", () => {
    const start = combineDateTime("2026-11-06", "09:00")!;
    const end = combineDateTime("2026-11-06", "12:30")!;
    expect(formatClubTimeRange(start, end)).toBe("9:00 AM – 12:30 PM");
  });

  it("shows only the start when a slot has no end", () => {
    expect(formatClubTimeRange(combineDateTime("2026-11-06", "09:00")!, null)).toBe("9:00 AM");
  });

  it("returns null when a slot has no start at all", () => {
    expect(formatClubTimeRange(null, null)).toBeNull();
  });
});

describe("upcomingCutoffIso", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is Chicago midnight, not process midnight (CST)", () => {
    // 10am Central on Jan 6.
    vi.setSystemTime(new Date("2026-01-06T16:00:00.000Z"));
    expect(upcomingCutoffIso()).toBe("2026-01-06T06:00:00.000Z");
  });

  it("is Chicago midnight, not process midnight (CDT)", () => {
    vi.setSystemTime(new Date("2026-07-15T16:00:00.000Z"));
    expect(upcomingCutoffIso()).toBe("2026-07-15T05:00:00.000Z");
  });

  it("still names yesterday's Chicago date at 1am UTC", () => {
    // 1am UTC on Jan 7 is still 7pm Jan 6 in Des Moines, so an event
    // happening "today" must not have been cut off yet.
    vi.setSystemTime(new Date("2026-01-07T01:00:00.000Z"));
    expect(upcomingCutoffIso()).toBe("2026-01-06T06:00:00.000Z");
  });

  it("does not cut off an event that starts later today", () => {
    vi.setSystemTime(new Date("2026-01-06T20:00:00.000Z")); // 2pm Central
    const eveningShift = combineDateTime("2026-01-06", "18:00")!;
    const thisMorning = combineDateTime("2026-01-06", "08:00")!;
    expect(eveningShift >= upcomingCutoffIso()).toBe(true);
    // An event earlier the same day is deliberately still included — the
    // cutoff is midnight, not "now."
    expect(thisMorning >= upcomingCutoffIso()).toBe(true);
    expect(combineDateTime("2026-01-05", "18:00")! >= upcomingCutoffIso()).toBe(false);
  });
});

// datesInRange / effectiveSlotDate take and return plain calendar strings and
// never cross a timezone, so they were not part of this bug — but they are
// pinned here so a future "fix" that pushes CLUB_TIME_ZONE into them (which
// would be wrong, see the comment on formatShortDate) fails loudly.
describe("datesInRange", () => {
  it("returns a single day for a single-day event", () => {
    expect(datesInRange("2026-11-06", "2026-11-06")).toEqual(["2026-11-06"]);
    expect(datesInRange("2026-11-06", "")).toEqual(["2026-11-06"]);
  });

  it("spans a weekend inclusively", () => {
    expect(datesInRange("2026-11-06", "2026-11-08")).toEqual([
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
  });

  it("crosses the DST fall-back Sunday without skipping or repeating a day", () => {
    // 2026-11-01 is the fall-back date; a naive +24h cursor would emit
    // 2026-11-01 twice.
    expect(datesInRange("2026-10-31", "2026-11-02")).toEqual([
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("crosses the DST spring-forward Sunday without skipping a day", () => {
    // 2026-03-08 is the spring-forward date.
    expect(datesInRange("2026-03-07", "2026-03-09")).toEqual([
      "2026-03-07",
      "2026-03-08",
      "2026-03-09",
    ]);
  });

  it("crosses a month and a year boundary", () => {
    expect(datesInRange("2026-12-31", "2027-01-02")).toEqual([
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  it("caps a typo'd range at 31 days", () => {
    expect(datesInRange("2026-01-01", "2029-01-01")).toHaveLength(31);
  });

  it("returns nothing without a start date", () => {
    expect(datesInRange("", "2026-11-08")).toEqual([]);
  });
});

describe("effectiveSlotDate", () => {
  it("forces a single-day event's only day regardless of the slot draft", () => {
    expect(effectiveSlotDate("", "2026-11-06", "2026-11-06")).toBe("2026-11-06");
    expect(effectiveSlotDate("2026-01-01", "2026-11-06", "")).toBe("2026-11-06");
  });

  it("passes the coach's pick through for a multi-day event", () => {
    expect(effectiveSlotDate("2026-11-07", "2026-11-06", "2026-11-08")).toBe("2026-11-07");
  });
});

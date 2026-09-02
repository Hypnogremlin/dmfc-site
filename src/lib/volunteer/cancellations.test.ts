import { describe, expect, it } from "vitest";
import {
  isCancellationInScope,
  isStaffCancelled,
  isUnreadCancellation,
} from "./cancellations";

// These three predicates decide whether a volunteer is ever told that the club
// took a shift away from them. A wrong answer here is silent in every
// direction: the row is simply absent from their dashboard, and no email
// exists to catch the miss.

describe("isStaffCancelled", () => {
  it("is false for a live signup", () => {
    expect(isStaffCancelled({ cancelled_at: null, cancelled_reason: null })).toBe(false);
  });

  it("is false when the member cancelled it themselves", () => {
    // The member RPC writes cancelled_at and nothing else. This is the case
    // that must stay invisible — they pressed the button, they know.
    expect(
      isStaffCancelled({ cancelled_at: "2026-09-01T12:00:00Z", cancelled_reason: null })
    ).toBe(false);
  });

  it("is true when the club cancelled it", () => {
    expect(
      isStaffCancelled({
        cancelled_at: "2026-09-01T12:00:00Z",
        cancelled_reason: "Tournament called off.",
      })
    ).toBe(true);
  });

  it("does not key off cancelled_by, which can go NULL long after the fact", () => {
    // cancelled_by is a FK to auth.users with ON DELETE SET NULL, so deleting
    // a departed coach's login nulls it. If that were the discriminator, an
    // old staff cancellation would silently reclassify as a member's own and
    // vanish from their dashboard. The reason column is never cleared.
    const row = {
      cancelled_at: "2026-09-01T12:00:00Z",
      cancelled_reason: "Tournament called off.",
      cancelled_by: null,
    };
    expect(isStaffCancelled(row)).toBe(true);
  });
});

describe("isCancellationInScope", () => {
  const cutoff = "2026-09-01T00:00:00Z";

  it("keeps a cancellation for a shift that has not happened yet", () => {
    expect(isCancellationInScope("2026-09-14T15:00:00Z", cutoff)).toBe(true);
  });

  it("drops one for a shift that has already passed", () => {
    // Bounds the list, so it can't accumulate forever and a never-visited
    // account isn't badged with every cancellation in club history.
    expect(isCancellationInScope("2026-08-01T15:00:00Z", cutoff)).toBe(false);
  });

  it("keeps an undated shift", () => {
    // Matches the /mine page's own treatment of a slot with no start_at as
    // upcoming: there is no date to say otherwise, and guessing in the
    // hide-it direction is the destructive guess.
    expect(isCancellationInScope(null, cutoff)).toBe(true);
  });
});

describe("isUnreadCancellation", () => {
  it("counts everything as unread when the member has never opened the page", () => {
    expect(isUnreadCancellation("2026-09-01T12:00:00Z", null)).toBe(true);
  });

  it("is unread when it happened after the last visit", () => {
    expect(isUnreadCancellation("2026-09-01T12:00:00Z", "2026-08-31T12:00:00Z")).toBe(true);
  });

  it("is read when it happened before the last visit", () => {
    expect(isUnreadCancellation("2026-08-30T12:00:00Z", "2026-08-31T12:00:00Z")).toBe(false);
  });

  it("is not unread when there is no cancellation timestamp at all", () => {
    expect(isUnreadCancellation(null, null)).toBe(false);
  });
});

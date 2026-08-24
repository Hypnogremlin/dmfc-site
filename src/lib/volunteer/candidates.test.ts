import { describe, expect, it } from "vitest";
import { candidatesFor, shouldShowPicker, type CandidateProfile } from "./candidates";

// Mirrors VOLUNTEERS.md's "Cases to test" table under "Candidate resolution."
// The worked household there — Holland (adult, fences), his wife (adult,
// fences), and three children (two sons, one daughter) — is the shape that
// breaks a naive implementation, so it gets its own dedicated case (#6)
// below. Every profile field not relevant to a given case is filled with an
// arbitrary but valid placeholder.

const ADULT_BIRTHDAY = "1985-01-01";
const MINOR_BIRTHDAY = "2014-06-01"; // ~12 years old as of 2026

function profile(overrides: Partial<CandidateProfile> & { id: string }): CandidateProfile {
  return {
    person_type: "athlete",
    first_name: "First",
    last_name: "Last",
    birthday: ADULT_BIRTHDAY,
    contact_phone: "5155550000",
    guardian_first_name: null,
    guardian_last_name: null,
    guardian_relationship: null,
    guardian_phone: null,
    ...overrides,
  };
}

describe("candidatesFor", () => {
  it("one adult fencer, no children -> 1 real candidate, no picker", () => {
    const candidates = candidatesFor([
      profile({ id: "a1", first_name: "Holland", last_name: "Reyes", contact_phone: "5155550100" }),
    ]);
    const real = candidates.filter((c) => c.kind !== "other");
    expect(real).toHaveLength(1);
    expect(shouldShowPicker(candidates)).toBe(false);
  });

  it("one minor + guardian on that minor's row -> 2 real candidates, picker shown", () => {
    const candidates = candidatesFor([
      profile({
        id: "c1",
        first_name: "Zane",
        last_name: "Reyes",
        birthday: MINOR_BIRTHDAY,
        contact_phone: "5155550101",
        guardian_first_name: "Holland",
        guardian_last_name: "Reyes",
        guardian_relationship: "Father",
        guardian_phone: "5155550100",
      }),
    ]);
    const real = candidates.filter((c) => c.kind !== "other");
    expect(real).toHaveLength(2);
    expect(real.some((c) => c.kind === "profile" && c.isMinor)).toBe(true);
    expect(real.some((c) => c.kind === "phantom" && c.name === "Holland Reyes")).toBe(true);
    expect(shouldShowPicker(candidates)).toBe(true);
  });

  it("two adult fencers, no children -> 2 real candidates, picker shown", () => {
    const candidates = candidatesFor([
      profile({ id: "a1", first_name: "Holland", last_name: "Reyes", contact_phone: "5155550100" }),
      profile({ id: "a2", first_name: "Priya", last_name: "Reyes", contact_phone: "5155550102" }),
    ]);
    expect(candidates.filter((c) => c.kind !== "other")).toHaveLength(2);
    expect(shouldShowPicker(candidates)).toBe(true);
  });

  it("two minors, same guardian on both -> dedupes to 3 real candidates", () => {
    const guardian = {
      guardian_first_name: "Holland",
      guardian_last_name: "Reyes",
      guardian_relationship: "Father",
      guardian_phone: "5155550100",
    };
    const candidates = candidatesFor([
      profile({ id: "c1", first_name: "Zane", birthday: MINOR_BIRTHDAY, contact_phone: "5155550101", ...guardian }),
      profile({ id: "c2", first_name: "Wren", birthday: MINOR_BIRTHDAY, contact_phone: "5155550103", ...guardian }),
    ]);
    const real = candidates.filter((c) => c.kind !== "other");
    expect(real).toHaveLength(3); // 2 minors + 1 deduped guardian, not 2 minors + 2 guardians
    expect(real.filter((c) => c.kind === "phantom")).toHaveLength(1);
    expect(shouldShowPicker(candidates)).toBe(true);
  });

  it("two minors, different guardians -> 4 real candidates", () => {
    const candidates = candidatesFor([
      profile({
        id: "c1",
        first_name: "Zane",
        birthday: MINOR_BIRTHDAY,
        contact_phone: "5155550101",
        guardian_first_name: "Holland",
        guardian_last_name: "Reyes",
        guardian_relationship: "Father",
        guardian_phone: "5155550100",
      }),
      profile({
        id: "c2",
        first_name: "Wren",
        birthday: MINOR_BIRTHDAY,
        contact_phone: "5155550103",
        guardian_first_name: "Priya",
        guardian_last_name: "Reyes",
        guardian_relationship: "Mother",
        guardian_phone: "5155550102",
      }),
    ]);
    const real = candidates.filter((c) => c.kind !== "other");
    expect(real).toHaveLength(4);
    expect(shouldShowPicker(candidates)).toBe(true);
  });

  it("two adult fencers + three minors, adults also listed as guardians -> 5 after dedupe, not 8", () => {
    const dad = {
      guardian_first_name: "Holland",
      guardian_last_name: "Reyes",
      guardian_relationship: "Father",
      guardian_phone: "5155550100",
    };
    const mom = {
      guardian_first_name: "Priya",
      guardian_last_name: "Reyes",
      guardian_relationship: "Mother",
      guardian_phone: "5155550102",
    };
    const candidates = candidatesFor([
      profile({ id: "a1", first_name: "Holland", last_name: "Reyes", contact_phone: "5155550100" }),
      profile({ id: "a2", first_name: "Priya", last_name: "Reyes", contact_phone: "5155550102" }),
      profile({ id: "c1", first_name: "Zane", last_name: "Reyes", birthday: MINOR_BIRTHDAY, contact_phone: "5155550101", ...dad }),
      profile({ id: "c2", first_name: "Wren", last_name: "Reyes", birthday: MINOR_BIRTHDAY, contact_phone: "5155550103", ...dad }),
      profile({ id: "c3", first_name: "Sela", last_name: "Reyes", birthday: MINOR_BIRTHDAY, contact_phone: "5155550104", ...mom }),
    ]);
    const real = candidates.filter((c) => c.kind !== "other");
    expect(real).toHaveLength(5);
    // The two adults must appear as their real profiles, not as duplicate
    // phantoms alongside themselves.
    expect(real.filter((c) => c.kind === "phantom")).toHaveLength(0);
    expect(real.filter((c) => c.kind === "profile" && !c.isMinor)).toHaveLength(2);
    expect(real.filter((c) => c.kind === "profile" && c.isMinor)).toHaveLength(3);
    expect(shouldShowPicker(candidates)).toBe(true);
  });

  it("always appends an 'other' escape hatch", () => {
    const candidates = candidatesFor([profile({ id: "a1" })]);
    expect(candidates[candidates.length - 1]).toEqual({ kind: "other" });
  });

  it("guardian name with no phone on file -> no phantom offered", () => {
    // claimSlot() would create a guardian profile from these fields, and
    // profiles.contact_phone is NOT NULL — a phantom with no phone is a
    // picker option that's guaranteed to fail, so candidatesFor() must not
    // emit it at all.
    const candidates = candidatesFor([
      profile({
        id: "c1",
        first_name: "Zane",
        birthday: MINOR_BIRTHDAY,
        contact_phone: "5155550101",
        guardian_first_name: "Holland",
        guardian_last_name: "Reyes",
        guardian_relationship: "Father",
        guardian_phone: null,
      }),
    ]);
    const real = candidates.filter((c) => c.kind !== "other");
    expect(real.filter((c) => c.kind === "phantom")).toHaveLength(0);
    expect(real).toHaveLength(1); // the minor only
    expect(shouldShowPicker(candidates)).toBe(false);
  });

  it("phantom guardian with no last name still renders (trims the trailing space)", () => {
    const candidates = candidatesFor([
      profile({
        id: "c1",
        first_name: "Zane",
        birthday: MINOR_BIRTHDAY,
        contact_phone: "5155550101",
        guardian_first_name: "Holland",
        guardian_last_name: null,
        guardian_relationship: "Father",
        guardian_phone: "5155550100",
      }),
    ]);
    const phantom = candidates.find((c) => c.kind === "phantom");
    expect(phantom).toMatchObject({ name: "Holland" });
  });

  it("known limitation: an adult's own contact_phone differing from the guardian_phone on a child's record does not dedupe", () => {
    // Holland the athlete has a cell number on his own profile; the phone
    // recorded as his child's guardian_phone is an old home number that was
    // never updated. dedupeKey() has no way to know these are the same
    // person — this is a documented gap in the source data (see the comment
    // above dedupeKey), not an implementation bug. Asserting it here means a
    // future change to the dedupe strategy will have to consciously decide
    // whether it changes this behavior, instead of silently doing so.
    const candidates = candidatesFor([
      profile({ id: "a1", first_name: "Holland", last_name: "Reyes", contact_phone: "5155559999" }),
      profile({
        id: "c1",
        first_name: "Zane",
        last_name: "Reyes",
        birthday: MINOR_BIRTHDAY,
        contact_phone: "5155550101",
        guardian_first_name: "Holland",
        guardian_last_name: "Reyes",
        guardian_relationship: "Father",
        guardian_phone: "5155550100", // stale — doesn't match a1's contact_phone
      }),
    ]);
    const real = candidates.filter((c) => c.kind !== "other");
    expect(real).toHaveLength(3); // Holland (real) + Zane (minor) + Holland (phantom) — not deduped
    expect(real.filter((c) => c.kind === "phantom")).toHaveLength(1);
  });
});

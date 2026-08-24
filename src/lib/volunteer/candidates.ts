// Candidate resolution for the volunteer attendee picker. Pure function, no
// Supabase calls — takes already-fetched profile rows and returns "who could
// this signup be for." See VOLUNTEERS.md "Candidate resolution — the subtle
// part" for the full worked examples this implements; do not simplify the
// dedupe step without re-reading that section first.
import { isMinor } from "@/lib/age";
import type { Profile } from "@/lib/member-types";

export type CandidateProfile = Pick<
  Profile,
  | "id"
  | "person_type"
  | "first_name"
  | "last_name"
  | "birthday"
  | "contact_phone"
  | "guardian_first_name"
  | "guardian_last_name"
  | "guardian_relationship"
  | "guardian_phone"
>;

export type Candidate =
  | { kind: "profile"; profileId: string; name: string; phone: string | null; isMinor: boolean }
  | {
      kind: "phantom";
      name: string;
      phone: string | null;
      relationship: string | null;
      seededFrom: string;
      isMinor: false;
    }
  | { kind: "other" };

// Normalizes a name+phone pair to a dedupe key. Strips everything but
// letters/digits so "(515) 555-0100" and "515-555-0100" collide, and so does
// "Holland Reyes" / "holland   reyes". A blank phone is not expected to
// reach this function: `profiles.contact_phone` is NOT NULL for every real
// profile, and the phantom-guardian loop below now requires guardian_phone
// before emitting a candidate at all — so two different people colliding on
// a blank-phone key is unreachable, not merely unlikely.
//
// A real gap this does NOT close: two different adults who happen to share a
// normalized name, or one adult whose own contact_phone differs from the
// guardian_phone recorded on a child's row (a stale copy after a number
// change), will not dedupe against each other and can each appear once. This
// matches VOLUNTEERS.md's dedupe spec as written — it is a known limitation
// of the source data, not a bug in this function.
function dedupeKey(name: string, phone: string | null): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${norm(name)}|${norm(phone ?? "")}`;
}

export function candidatesFor(profiles: CandidateProfile[]): Candidate[] {
  const candidates: Candidate[] = [];

  // 1 & 2. Real rows: adult athletes, existing guardians, and minors (minors
  // are candidates too — a slot's adults_only flag filters them out later,
  // per-slot, not here).
  for (const p of profiles) {
    const minor = p.person_type === "athlete" && isMinor(p.birthday);
    candidates.push({
      kind: "profile",
      profileId: p.id,
      name: `${p.first_name} ${p.last_name}`,
      phone: p.contact_phone || null,
      isMinor: minor,
    });
  }

  // 3. Phantom guardians, gathered across every profile carrying guardian_*
  // data (each minor's row carries its own copy, per D2/D7). Requires a
  // phone, not just a name: claiming a phantom lazily creates a profile row
  // (see actions.ts), and profiles.contact_phone is NOT NULL — a phantom
  // with no phone is a picker option that is guaranteed to fail the moment
  // it's tapped, so it's excluded here rather than offered and rejected.
  for (const p of profiles) {
    if (p.guardian_first_name && p.guardian_phone) {
      candidates.push({
        kind: "phantom",
        name: `${p.guardian_first_name} ${p.guardian_last_name ?? ""}`.trim(),
        phone: p.guardian_phone || null,
        relationship: p.guardian_relationship,
        seededFrom: p.id,
        isMinor: false,
      });
    }
  }

  // 4. Dedupe by normalized name+phone. A real profile always beats a
  // phantom sharing its identity (an adult who both fences and is listed as
  // a guardian should appear once, as themselves).
  const byKey = new Map<string, Candidate>();
  for (const c of candidates) {
    if (c.kind === "other") continue;
    const key = dedupeKey(c.name, c.phone);
    const existing = byKey.get(key);
    if (!existing || (existing.kind === "phantom" && c.kind === "profile")) {
      byKey.set(key, c);
    }
  }

  return [...byKey.values(), { kind: "other" }];
}

// Per VOLUNTEERS.md: render the picker only when there's more than one real
// person plus the "Someone else…" escape hatch. A single real candidate
// should be recorded silently, not offered as a one-option radio group.
export function shouldShowPicker(candidates: Candidate[]): boolean {
  return candidates.length > 2;
}

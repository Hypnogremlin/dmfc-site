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
  | {
      kind: "profile";
      profileId: string;
      name: string;
      phone: string | null;
      isMinor: boolean;
      // True when this row IS a guardian identity: either a person_type
      // 'guardian' row, or an adult who also appears as a phantom guardian on
      // a child's record and absorbed that phantom during dedupe (an adult who
      // both fences and is the listed parent). Drives both the ordering below
      // and the picker's label.
      isGuardian: boolean;
      // "Father", "Grandmother" — free text, from guardian_relationship.
      // Null for an adult athlete or a volunteer who guards nobody.
      relationship: string | null;
    }
  | {
      kind: "phantom";
      name: string;
      phone: string | null;
      relationship: string | null;
      seededFrom: string;
      isMinor: false;
    }
  | { kind: "other" };

// Ordering rank. Lower sorts first.
//
// THE RULE (owner directive, 2026-08-31): **a guardian is the default.** The
// whole feature exists because a parent signs a child up and the check-in
// roster then reads a twelve-year-old's name (VOLUNTEERS.md, "The problem we
// are solving"). Preselecting the child reproduces exactly that bug for any
// parent who taps "Sign up" without reading the radio group, so guardians
// come first and minors sort last:
//
//   0  guardian identities — real 'guardian' rows first, then phantoms
//      (both share this rank; real rows are pushed before phantoms below, and
//      the sort is stable, so a materialized guardian outranks an unmaterialized
//      one without needing its own rank)
//   1  other adults — adult athletes and 'volunteer' rows (D14)
//   2  minor athletes
//   3  "Someone else…"
//
// **Several adults in one household** (two parents; or an adult who both
// fences and is a listed guardian) all land in rank 0 or 1, and ties are
// broken by *input order only* — the sort is stable and the caller passes
// profiles ordered by created_at (see the volunteer event page). No attempt is
// made to guess which parent is showing up: any such guess would be wrong half
// the time, and the picker is rendered in exactly this case so the household
// can say. What matters is that the guess is (a) an adult and (b) the same
// adult on every page load.
//
// Note that an adult athlete who is also a listed guardian ranks 0, not 1,
// because dedupe merges the phantom into their real row and sets isGuardian.
function rank(c: Candidate): number {
  if (c.kind === "other") return 3;
  if (c.kind === "phantom") return 0;
  if (c.isGuardian) return 0;
  return c.isMinor ? 2 : 1;
}

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
      isGuardian: p.person_type === "guardian",
      // A 'guardian' row carries its own guardian_relationship, seeded from
      // the athlete it was created from (create_guardian_profile). On an
      // athlete or volunteer row those columns describe somebody else's
      // parent, so they are not this candidate's relationship.
      relationship: p.person_type === "guardian" ? p.guardian_relationship : null,
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
    if (!existing) {
      byKey.set(key, c);
      continue;
    }
    // A collision means the same human reached this function twice. The real
    // profile always survives — but the phantom carries the fact that this
    // person is somebody's guardian, and their relationship word, so that is
    // merged onto the survivor rather than discarded. Without this, Holland
    // (who both fences and is Zane's father) would rank as a plain adult and
    // could lose the default to a phantom of his spouse.
    const winner = existing.kind === "phantom" && c.kind === "profile" ? c : existing;
    const loser = winner === existing ? c : existing;
    if (winner.kind === "profile" && loser.kind === "phantom") {
      winner.isGuardian = true;
      winner.relationship = winner.relationship ?? loser.relationship;
    }
    byKey.set(key, winner);
  }

  // 5. Guardians first, minors last — see rank() above. Stable, so input order
  // (created_at, per the caller) breaks every tie.
  const resolved = [...byKey.values()].sort((a, b) => rank(a) - rank(b));

  return [...resolved, { kind: "other" }];
}

// Per VOLUNTEERS.md: render the picker only when there's more than one real
// person plus the "Someone else…" escape hatch. A single real candidate
// should be recorded silently, not offered as a one-option radio group.
export function shouldShowPicker(candidates: Candidate[]): boolean {
  return candidates.length > 2;
}

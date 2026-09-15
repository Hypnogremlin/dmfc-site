// Builds a Google Contacts import CSV from the club roster.
//
// Pure function, no Supabase calls — takes already-fetched profile rows, the
// same shape as src/lib/volunteer/candidates.ts. The route handler
// (src/app/api/staff/contacts-export/route.ts) owns the fetch and the auth
// gates; everything here is data shaping.
//
// ── The unit of export is an ADULT, not a profile row ───────────────────────
//
// This list exists to email people. A minor fences but does not read email:
// `profiles.contact_email` on a child's row is, in practice, their parent's
// address. Emitting a row per profile therefore produced two contacts sharing
// one address (the child and the parent), which is both useless to mail and
// exactly the shape Google's "Merge & fix" tries to collapse.
//
// So children are not exported at all. Each household contributes one contact
// per *adult*: adult athletes, guardians, and volunteers. An adult who is
// several of those at once — someone who fences AND is the parent on file —
// is ONE contact carrying all of it, not one row per role.
//
// A minor's weapon still reaches the export, as a label on their guardian's
// contact, so "email everyone in youth foil" reaches the parents who actually
// read it. That is the whole point of putting weapons on guardian rows.
//
// ── Format notes, all load-bearing ──────────────────────────────────────────
//
// * The `Labels` cell is multi-valued, and its delimiter is " ::: " — space,
//   three colons, space. NOT a comma. A comma there still produces a valid
//   CSV (the cell just gets quoted) and imports without error; it simply
//   creates one label named "DMFC Members,DMFC Foil (Youth)". There is no
//   failure signal, so the only way to catch a regression here is to actually
//   import the file. Do not "simplify" this to a join(",").
//
// * Google matches columns by header text, and accepts arbitrarily numbered
//   ones — "E-mail 2 - Value", "Relation 3 - Label" and so on — even though
//   the downloadable template ships with only one of each. That is what lets
//   the relation columns widen to fit the largest household.
//
// * `Relation` is a first-class field: Google renders it as a "Related
//   people" section on the contact card. Children appear there, by name, on
//   their parent's contact — so a coach can still see who a parent belongs to
//   even though the child has no contact of their own.
import {
  MEMBERSHIP_SEASON,
  WEAPON_LABELS,
  type PersonType,
  type WeaponClass,
} from "@/lib/member-types";
import { isMinor } from "@/lib/age";
import { buildCsv, type CsvColumn } from "@/lib/csv";

// Exactly the columns selected in the route handler. Hand-typed: this repo
// has no generated Supabase types (see the same note in
// src/app/member/staff/directory/page.tsx).
//
// `birthday` is read but NEVER exported — it is here solely to answer "is
// this athlete an adult", which decides whether they get a contact at all.
// See the Birthday column at the bottom of this file, which is always blank.
export type ContactExportRow = {
  id: string;
  account_owner_id: string;
  person_type: PersonType;
  first_name: string;
  last_name: string;
  birthday: string | null;
  weapon_classes: WeaponClass[];
  membership_season: string | null;
  enrollment_complete: boolean;
  contact_email: string;
  contact_phone: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  guardian_first_name: string | null;
  guardian_last_name: string | null;
  guardian_relationship: string | null;
  guardian_phone: string | null;
};

// All group names are DMFC-prefixed. These land in a coach's *personal*
// Google account alongside whatever labels they already keep, so an
// unprefixed "Members" or "Saber" would be an unpleasant surprise.
const LABEL_ALL = "DMFC Members";
const LABEL_GUARDIANS = "DMFC Guardians";
const LABEL_VOLUNTEERS = "DMFC Volunteers";

const LABEL_DELIMITER = " ::: ";

const ORGANIZATION = "Des Moines Fencing Club";

function weaponLabel(weapon: WeaponClass): string {
  return WEAPON_LABELS[weapon] ?? weapon;
}

function weaponGroupLabel(weapon: WeaponClass): string {
  return `DMFC ${weaponLabel(weapon)}`;
}

function fullName(first: string, last: string): string {
  return `${first} ${last}`.trim();
}

/**
 * A fencer who is actually on the club right now: current season AND
 * enrollment finished. Both conditions are athlete-only — `person_type`
 * 'guardian'/'volunteer' rows never carry a season and never flip
 * enrollment_complete, so this predicate must only ever be applied to
 * athletes (see the scoping step in buildGoogleContactsCsv).
 */
function isCurrentAthlete(row: ContactExportRow): boolean {
  return (
    row.person_type === "athlete" &&
    row.membership_season === MEMBERSHIP_SEASON &&
    row.enrollment_complete
  );
}

/**
 * Identity key for an adult *within one household*.
 *
 * Name-only, normalized. Globally that would be far too loose, but the
 * database already treats name-within-account as a guardian's identity —
 * `profiles_one_guardian_identity_per_account_idx` is UNIQUE on
 * (account_owner_id, lower(btrim(first_name)), lower(btrim(last_name)))
 * WHERE person_type = 'guardian'. Matching that exactly is what lets one
 * adult absorb every role they hold: a real guardian row, the guardian_* text
 * on each of their children's rows, and their own athlete row if they fence.
 * Keying on name+phone the way candidates.ts does would split that person
 * back apart whenever a phone number was updated on only some of the records.
 */
function householdKey(first: string, last: string): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${norm(first)}|${norm(last)}`;
}

type Relation = { label: string; value: string };

// One adult, accumulated across every role they hold in their household.
type AdultDraft = {
  firstName: string;
  lastName: string;
  emails: string[];
  phones: string[];
  street: string;
  city: string;
  region: string;
  postalCode: string;
  /** This person's OWN weapons — only ever set when they themselves fence. */
  weapons: WeaponClass[];
  /** Fencers this person is the guardian of. */
  children: ContactExportRow[];
  /**
   * Numbers recorded against this person on their children's rows, in child
   * order. Kept apart from `phones` so the composition rule in step 3d can be
   * applied once, rather than depending on the order roles happened to be
   * folded in.
   */
  guardianPhones: string[];
  /** The household's own word: "Father", "Grandmother". */
  relationship: string | null;
  isGuardian: boolean;
  isAthlete: boolean;
  isVolunteer: boolean;
  /**
   * True once this adult has been seen as a real `profiles` row. Decides
   * whose phone number leads: their own `contact_phone` when they have a
   * record, otherwise the `guardian_phone` recorded against their children.
   */
  hasProfileRow: boolean;
};

function streetOf(row: ContactExportRow): string {
  if (!row.address_line1) return "";
  return row.address_line2
    ? `${row.address_line1}, ${row.address_line2}`
    : row.address_line1;
}

// Dedupe while preserving first-seen order, so label and relation lists are
// stable between exports rather than reshuffling on every download.
function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function draftFrom(row: ContactExportRow): AdultDraft {
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    emails: [row.contact_email].filter(Boolean),
    phones: [row.contact_phone].filter(Boolean),
    street: streetOf(row),
    city: row.city ?? "",
    region: row.state ?? "",
    postalCode: row.zip_code ?? "",
    weapons: [],
    children: [],
    guardianPhones: [],
    relationship: null,
    isGuardian: false,
    isAthlete: false,
    isVolunteer: false,
    hasProfileRow: false,
  };
}

/**
 * @param rows   Every profile row for the club, unfiltered. Scoping to the
 *               current season happens here, not in the query.
 * @param accountEmails  account_owner_id → the login email on auth.users.
 *               Used only to add a second address when an adult's own
 *               contact_email differs from the address the household signs in
 *               with. Pass an empty Map to skip that entirely.
 */
export function buildGoogleContactsCsv(
  rows: ContactExportRow[],
  accountEmails: Map<string, string>
): string {
  // ── 1. Scope ──────────────────────────────────────────────────────────────
  // Current-season, fully-enrolled athletes define which households are in
  // the export: this list is for people actually involved in the club, so a
  // half-finished registration doesn't earn a place in a coach's contacts.
  // Note this is stricter than the staff directory page, which shows
  // in-progress enrollments on purpose so staff can chase them.
  //
  // Guardian and volunteer rows carry membership_season = NULL *and*
  // enrollment_complete = false by default — neither flag means anything on a
  // non-athlete row, so applying either to them would silently drop every
  // parent. They come in via their household instead.
  const currentAthletes = rows.filter(isCurrentAthlete);
  const householdIds = new Set(currentAthletes.map((r) => r.account_owner_id));

  // A lapsed or half-enrolled athlete in an otherwise-current household is
  // still excluded here, while their sibling and parent are kept.
  const included = rows.filter(
    (r) =>
      householdIds.has(r.account_owner_id) &&
      (r.person_type !== "athlete" || isCurrentAthlete(r))
  );

  // ── 2. Group by household ─────────────────────────────────────────────────
  const households = new Map<string, ContactExportRow[]>();
  for (const row of included) {
    const existing = households.get(row.account_owner_id);
    if (existing) existing.push(row);
    else households.set(row.account_owner_id, [row]);
  }

  const contacts: AdultDraft[] = [];

  for (const [ownerId, members] of households) {
    const athletes = members.filter((m) => m.person_type === "athlete");
    const accountEmail = accountEmails.get(ownerId) ?? null;

    // One entry per adult identity in this household, keyed by name. Every
    // role that person holds folds into the same entry.
    const adults = new Map<string, AdultDraft>();

    const upsert = (first: string, last: string, seed: ContactExportRow) => {
      const key = householdKey(first, last);
      let draft = adults.get(key);
      if (!draft) {
        draft = draftFrom(seed);
        draft.firstName = first;
        draft.lastName = last;
        adults.set(key, draft);
      }
      return draft;
    };

    // 3a. Real profile rows that are themselves adults.
    for (const m of members) {
      if (m.person_type === "athlete" && isMinor(m.birthday)) continue;

      const draft = upsert(m.first_name, m.last_name, m);
      // A real row is the best source of contact details, so its own email,
      // phone and address take precedence over anything folded in later.
      draft.hasProfileRow = true;
      draft.emails.unshift(m.contact_email);
      draft.phones.unshift(m.contact_phone);
      if (streetOf(m)) {
        draft.street = streetOf(m);
        draft.city = m.city ?? "";
        draft.region = m.state ?? "";
        draft.postalCode = m.zip_code ?? "";
      }
      if (m.person_type === "athlete") {
        draft.isAthlete = true;
        draft.weapons.push(...m.weapon_classes);
      }
      if (m.person_type === "guardian") {
        draft.isGuardian = true;
        draft.relationship = draft.relationship ?? m.guardian_relationship;
      }
      if (m.person_type === "volunteer") draft.isVolunteer = true;
    }

    // 3b. Guardians named on a child's row. When that name already belongs to
    // an adult above — a parent who also fences, or who has a real guardian
    // row — this merges into them rather than creating a second contact.
    for (const child of athletes) {
      if (!child.guardian_first_name) continue;
      const draft = upsert(
        child.guardian_first_name,
        child.guardian_last_name ?? "",
        // profiles has no guardian_email column at all, so when this parent
        // has no record of their own, the child's contact_email is the only
        // address available — which in practice IS the parent's, since a
        // minor enrolls under one.
        child
      );
      draft.isGuardian = true;
      draft.children.push(child);
      draft.relationship = draft.relationship ?? child.guardian_relationship;
      if (child.guardian_phone) draft.guardianPhones.push(child.guardian_phone);
    }

    // 3c. Fallback: a minor with nobody on record to email. Dropping them
    // would make the household unreachable, which is worse than the
    // duplicate-email problem this whole restructure exists to fix — so the
    // child's own record stands in, since its contact_email is the address
    // the club actually has for them.
    for (const child of athletes) {
      if (!isMinor(child.birthday)) continue;
      if (child.guardian_first_name) continue;
      const draft = upsert(child.first_name, child.last_name, child);
      draft.isAthlete = true;
      draft.weapons.push(...child.weapon_classes);
    }

    // 3d. Attach the login email where it differs, and tidy.
    for (const draft of adults.values()) {
      if (accountEmail) draft.emails.push(accountEmail);
      draft.emails = unique(draft.emails).filter(Boolean);
      // Whose number leads: an adult with a record of their own is best
      // described by their own contact_phone. An adult who exists only as
      // guardian_* text has no contact_phone — the seed phone on their draft
      // belongs to their child's record — so the number explicitly recorded
      // against them wins, earliest child first.
      draft.phones = unique(
        draft.hasProfileRow
          ? [...draft.phones, ...draft.guardianPhones]
          : [...draft.guardianPhones, ...draft.phones]
      ).filter(Boolean);
      draft.weapons = unique(draft.weapons);
      contacts.push(draft);
    }
  }

  contacts.sort(
    (a, b) =>
      a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
  );

  // ── 4. Derive the label set and relations for each contact ────────────────
  const labelsFor = (d: AdultDraft): string[] => {
    const childWeapons = d.children.flatMap((c) => c.weapon_classes);
    return unique([
      LABEL_ALL,
      ...d.weapons.map(weaponGroupLabel),
      ...(d.isGuardian ? [LABEL_GUARDIANS] : []),
      // A guardian carries their fencers' weapons so that emailing a weapon
      // group reaches the parent who actually reads mail.
      ...childWeapons.map(weaponGroupLabel),
      ...(d.isVolunteer ? [LABEL_VOLUNTEERS] : []),
    ]);
  };

  const relationsFor = (d: AdultDraft): Relation[] =>
    d.children.map((c) => ({
      label: "Child",
      value: fullName(c.first_name, c.last_name),
    }));

  const notesFor = (d: AdultDraft): string => {
    const parts: string[] = [];
    if (d.isAthlete) {
      parts.push(
        `DMFC fencer (${d.weapons.map(weaponLabel).join(" / ") || "no weapon on file"}), ${MEMBERSHIP_SEASON} season.`
      );
    }
    if (d.children.length) {
      // Name each fencer with their weapon — this is the only place a coach
      // can see which child a parent belongs to and what they fence, now that
      // children have no contacts of their own.
      const kids = d.children
        .map((c) => {
          const w = c.weapon_classes.map(weaponLabel).join(" / ");
          return w
            ? `${fullName(c.first_name, c.last_name)} (${w})`
            : fullName(c.first_name, c.last_name);
        })
        .join(", ");
      parts.push(`DMFC guardian of ${kids}.`);
    }
    if (d.isVolunteer) parts.push("DMFC volunteer.");
    return parts.join(" ");
  };

  // ── 5. Flatten to columns ─────────────────────────────────────────────────
  // Header order follows Google's downloadable template, with the extra
  // numbered columns slotted in beside their "1" counterparts. Order is
  // cosmetic to the importer (it matches on header text) but makes the file
  // readable when a coach opens it in Sheets before importing.
  const maxEmails = Math.max(1, ...contacts.map((c) => c.emails.length));
  const maxPhones = Math.max(1, ...contacts.map((c) => c.phones.length));
  const maxRelations = Math.max(0, ...contacts.map((c) => relationsFor(c).length));

  const columns: CsvColumn<AdultDraft>[] = [
    ["Name Prefix", () => ""],
    ["First Name", (c) => c.firstName],
    ["Middle Name", () => ""],
    ["Last Name", (c) => c.lastName],
    ["Name Suffix", () => ""],
  ];

  for (let i = 0; i < maxEmails; i++) {
    columns.push([`E-mail ${i + 1} - Label`, (c) => (c.emails[i] ? "Home" : "")]);
    columns.push([`E-mail ${i + 1} - Value`, (c) => c.emails[i] ?? ""]);
  }

  for (let i = 0; i < maxPhones; i++) {
    columns.push([`Phone ${i + 1} - Label`, (c) => (c.phones[i] ? "Mobile" : "")]);
    columns.push([`Phone ${i + 1} - Value`, (c) => c.phones[i] ?? ""]);
  }

  columns.push(
    ["Address 1 - Label", (c) => (c.street ? "Home" : "")],
    ["Address 1 - Country", (c) => (c.street ? "United States" : "")],
    ["Address 1 - Street", (c) => c.street],
    ["Address 1 - Extended Address", () => ""],
    ["Address 1 - City", (c) => c.city],
    ["Address 1 - Region", (c) => c.region],
    ["Address 1 - Postal Code", (c) => c.postalCode],
    ["Address 1 - PO Box", () => ""],
    ["Organization Name", () => ORGANIZATION],
    ["Organization Title", () => ""],
    ["Organization Department", () => ""],
    // Present so the header matches Google's template, always empty. Birthday
    // is read from the database to decide who counts as an adult, and is
    // deliberately never written out.
    ["Birthday", () => ""]
  );

  for (let i = 0; i < maxRelations; i++) {
    columns.push([
      `Relation ${i + 1} - Label`,
      (c) => relationsFor(c)[i]?.label ?? "",
    ]);
    columns.push([
      `Relation ${i + 1} - Value`,
      (c) => relationsFor(c)[i]?.value ?? "",
    ]);
  }

  columns.push(
    ["Custom Field 1 - Label", (c) => (c.weapons.length ? "Weapon" : "")],
    ["Custom Field 1 - Value", (c) => c.weapons.map(weaponLabel).join(" / ")],
    ["Notes", (c) => notesFor(c)],
    // " ::: ", not ",". See the header comment.
    ["Labels", (c) => labelsFor(c).join(LABEL_DELIMITER)]
  );

  return buildCsv(columns, contacts);
}

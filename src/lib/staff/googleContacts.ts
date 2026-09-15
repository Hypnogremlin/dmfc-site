// Builds a Google Contacts import CSV from the club roster.
//
// Pure function, no Supabase calls — takes already-fetched profile rows, the
// same shape as src/lib/volunteer/candidates.ts. The route handler
// (src/app/api/staff/contacts-export/route.ts) owns the fetch and the auth
// gates; everything here is data shaping.
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
//   people" section on the contact card. That's why the guardian/fencer link
//   lives there rather than in a Custom Field, which would render as a flat
//   row of text. Custom Field 1 is spent on the weapon instead.
import {
  MEMBERSHIP_SEASON,
  WEAPON_LABELS,
  type PersonType,
  type WeaponClass,
} from "@/lib/member-types";
import { buildCsv, type CsvColumn } from "@/lib/csv";

// Exactly the columns selected in the route handler. Hand-typed: this repo
// has no generated Supabase types (see the same note in
// src/app/member/staff/directory/page.tsx). Deliberately carries no birthday,
// sex_at_birth, gender_identity, USAF/citizenship, waiver, or medical field —
// see the route's `select` for why that list is the security boundary.
export type ContactExportRow = {
  id: string;
  account_owner_id: string;
  person_type: PersonType;
  first_name: string;
  last_name: string;
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
 * Identity key for an adult *within one household*.
 *
 * Name-only, normalized. Globally that would be far too loose, but the
 * database already treats name-within-account as a guardian's identity —
 * `profiles_one_guardian_identity_per_account_idx` is UNIQUE on
 * (account_owner_id, lower(btrim(first_name)), lower(btrim(last_name)))
 * WHERE person_type = 'guardian'. Matching that exactly is what lets a real
 * guardian row absorb the phantom guardian_* text on their children's rows
 * even when the two carry different phone numbers, which is the common case
 * after somebody changes their number and only one record gets updated.
 */
function householdKey(first: string, last: string): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${norm(first)}|${norm(last)}`;
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

type Relation = { label: string; value: string };

// One output row, before it is flattened into CSV columns.
type Contact = {
  firstName: string;
  lastName: string;
  emails: string[];
  phones: string[];
  street: string;
  city: string;
  region: string;
  postalCode: string;
  weapons: WeaponClass[];
  relations: Relation[];
  labels: string[];
  notes: string;
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

/**
 * @param rows   Every profile row for the club, unfiltered. Scoping to the
 *               current season happens here, not in the query.
 * @param accountEmails  account_owner_id → the login email on auth.users.
 *               Used only to add a second address when a guardian's own
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

  const contacts: Contact[] = [];

  for (const [ownerId, members] of households) {
    const athletes = members.filter((m) => m.person_type === "athlete");
    const accountEmail = accountEmails.get(ownerId) ?? null;

    // ── 3. Resolve one guardian identity per adult in this household ────────
    // Real `guardian` profile rows come first so they win any collision; the
    // phantom guardian_* columns on each child's row are then folded into a
    // matching adult, or materialized as their own contact when no real row
    // exists for that name.
    type GuardianDraft = {
      firstName: string;
      lastName: string;
      emails: string[];
      phones: string[];
      street: string;
      city: string;
      region: string;
      postalCode: string;
      children: ContactExportRow[];
      relationship: string | null;
    };
    const guardians = new Map<string, GuardianDraft>();

    for (const g of members.filter((m) => m.person_type === "guardian")) {
      guardians.set(householdKey(g.first_name, g.last_name), {
        firstName: g.first_name,
        lastName: g.last_name,
        emails: [g.contact_email],
        phones: [g.contact_phone],
        street: streetOf(g),
        city: g.city ?? "",
        region: g.state ?? "",
        postalCode: g.zip_code ?? "",
        children: [],
        relationship: g.guardian_relationship,
      });
    }

    for (const child of athletes) {
      if (!child.guardian_first_name) continue;
      const first = child.guardian_first_name;
      const last = child.guardian_last_name ?? "";
      const key = householdKey(first, last);

      let draft = guardians.get(key);
      if (!draft) {
        // A phantom guardian: named on the child's row but with no profile of
        // their own. profiles has no guardian_email column at all, so the
        // child's contact_email is the only address available — which in
        // practice IS the parent's, since a minor enrolls under one.
        draft = {
          firstName: first,
          lastName: last,
          emails: [child.contact_email],
          phones: child.guardian_phone ? [child.guardian_phone] : [],
          street: streetOf(child),
          city: child.city ?? "",
          region: child.state ?? "",
          postalCode: child.zip_code ?? "",
          children: [],
          relationship: child.guardian_relationship,
        };
        guardians.set(key, draft);
      }
      draft.children.push(child);
      draft.relationship = draft.relationship ?? child.guardian_relationship;
      if (child.guardian_phone) draft.phones.push(child.guardian_phone);
    }

    // ── 4. Emit the guardians ───────────────────────────────────────────────
    for (const draft of guardians.values()) {
      // A household that signed up under one address will have the login
      // email already present; only a genuinely different one is added.
      const emails = unique([
        ...draft.emails,
        ...(accountEmail ? [accountEmail] : []),
      ]).filter(Boolean);

      const childWeapons = draft.children.flatMap((c) => c.weapon_classes);

      contacts.push({
        firstName: draft.firstName,
        lastName: draft.lastName,
        emails,
        phones: unique(draft.phones).filter(Boolean),
        street: draft.street,
        city: draft.city,
        region: draft.region,
        postalCode: draft.postalCode,
        weapons: [],
        // Their fencers, so the coach can see who a parent belongs to
        // without cross-referencing. Label defaults to "Child" when the
        // household never recorded a relationship word.
        relations: draft.children.map((c) => ({
          label: "Child",
          value: fullName(c.first_name, c.last_name),
        })),
        labels: unique([
          LABEL_ALL,
          LABEL_GUARDIANS,
          ...childWeapons.map(weaponGroupLabel),
        ]),
        notes: draft.children.length
          ? `DMFC guardian of ${draft.children
              .map((c) => fullName(c.first_name, c.last_name))
              .join(", ")}.`
          : "DMFC guardian.",
      });
    }

    // ── 5. Emit the athletes ────────────────────────────────────────────────
    for (const athlete of athletes) {
      // Which adult is this fencer's parent, by the same household key used
      // above — so the Parent relation names whoever actually got emitted.
      const guardianDraft = athlete.guardian_first_name
        ? guardians.get(
            householdKey(athlete.guardian_first_name, athlete.guardian_last_name ?? "")
          )
        : undefined;

      contacts.push({
        firstName: athlete.first_name,
        lastName: athlete.last_name,
        emails: [athlete.contact_email].filter(Boolean),
        phones: [athlete.contact_phone].filter(Boolean),
        street: streetOf(athlete),
        city: athlete.city ?? "",
        region: athlete.state ?? "",
        postalCode: athlete.zip_code ?? "",
        weapons: athlete.weapon_classes,
        relations: guardianDraft
          ? [
              {
                // The household's own word — "Father", "Grandmother" — when
                // they gave one. Google accepts free text here.
                label: guardianDraft.relationship || "Parent",
                value: fullName(guardianDraft.firstName, guardianDraft.lastName),
              },
            ]
          : [],
        labels: unique([
          LABEL_ALL,
          ...athlete.weapon_classes.map(weaponGroupLabel),
        ]),
        notes: `DMFC fencer, ${MEMBERSHIP_SEASON} season.`,
      });
    }

    // ── 6. Emit volunteers ──────────────────────────────────────────────────
    for (const v of members.filter((m) => m.person_type === "volunteer")) {
      contacts.push({
        firstName: v.first_name,
        lastName: v.last_name,
        emails: [v.contact_email].filter(Boolean),
        phones: [v.contact_phone].filter(Boolean),
        street: streetOf(v),
        city: v.city ?? "",
        region: v.state ?? "",
        postalCode: v.zip_code ?? "",
        weapons: [],
        relations: [],
        labels: [LABEL_ALL, LABEL_VOLUNTEERS],
        notes: "DMFC volunteer.",
      });
    }
  }

  contacts.sort(
    (a, b) =>
      a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
  );

  // ── 7. Flatten to columns ─────────────────────────────────────────────────
  // Header order follows Google's downloadable template, with the extra
  // numbered columns slotted in beside their "1" counterparts. Order is
  // cosmetic to the importer (it matches on header text) but makes the file
  // readable when a coach opens it in Sheets before importing.
  const maxEmails = Math.max(1, ...contacts.map((c) => c.emails.length));
  const maxPhones = Math.max(1, ...contacts.map((c) => c.phones.length));
  const maxRelations = Math.max(0, ...contacts.map((c) => c.relations.length));

  const columns: CsvColumn<Contact>[] = [
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
    // Present so the header matches the template, always empty: a member's
    // date of birth is not exported. See the route's select list.
    ["Birthday", () => ""]
  );

  for (let i = 0; i < maxRelations; i++) {
    columns.push([`Relation ${i + 1} - Label`, (c) => c.relations[i]?.label ?? ""]);
    columns.push([`Relation ${i + 1} - Value`, (c) => c.relations[i]?.value ?? ""]);
  }

  columns.push(
    ["Custom Field 1 - Label", (c) => (c.weapons.length ? "Weapon" : "")],
    [
      "Custom Field 1 - Value",
      (c) => c.weapons.map(weaponLabel).join(" / "),
    ],
    ["Notes", (c) => c.notes],
    // " ::: ", not ",". See the header comment.
    ["Labels", (c) => c.labels.join(LABEL_DELIMITER)]
  );

  return buildCsv(columns, contacts);
}

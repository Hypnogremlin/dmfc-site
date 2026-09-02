import type { Metadata } from "next";
import { createSessionClient } from "@/lib/supabase-server";
import { Section } from "@/components/Section";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { PrintDirectoryButton } from "@/components/volunteer/PrintDirectoryButton";
import type { WeaponClass } from "@/lib/member-types";
import { MEMBERSHIP_SEASON } from "@/lib/member-types";

export const metadata: Metadata = {
  title: "Staff — Member Directory",
};

// Shape of one row from staff_member_directory(). Hand-typed, matching the
// RPC's RETURNS TABLE in 20260901_staff_directory_remove_medical.sql — this
// repo has no generated Supabase types (see src/lib/volunteer/types.ts).
// Deliberately missing sex_at_birth, gender_identity, and every waiver
// field: the RPC itself never selects them, so there is nothing here to
// accidentally render. medical_conditions/preferred_medical_system were
// dropped from the RPC's return shape entirely (not just hidden here) —
// there's no vetted secure channel for staff to see medical notes yet.
// We'll likely bring this back once one exists.
type EmergencyContactRow = {
  contact_order: 1 | 2;
  first_name: string;
  last_name: string;
  relationship: string;
  email: string | null;
  email_2: string | null;
  phone: string;
  phone_2: string | null;
};

type DirectoryRow = {
  id: string;
  person_type: "athlete" | "guardian" | "volunteer";
  first_name: string;
  last_name: string;
  birthday: string | null;
  weapon_classes: WeaponClass[];
  shirt_size: string | null;
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
  emergency_contacts: EmergencyContactRow[];
};

const WEAPON_LABELS: Record<WeaponClass, string> = {
  "foil-youth": "Foil (Youth)",
  "foil-adult": "Foil (Adult)",
  epee: "Epee",
  saber: "Saber",
};

const PERSON_TYPE_LABELS: Record<DirectoryRow["person_type"], string> = {
  athlete: "Athlete",
  guardian: "Guardian",
  volunteer: "Volunteer",
};

function formatWeapons(classes: WeaponClass[]): string {
  if (!classes || classes.length === 0) return "";
  return classes.map((c) => WEAPON_LABELS[c] ?? c).join(" · ");
}

function formatAddress(row: DirectoryRow): string | null {
  if (!row.address_line1) return null;
  const line2 = row.address_line2 ? `${row.address_line2}, ` : "";
  const cityState = [row.city, row.state].filter(Boolean).join(", ");
  return `${row.address_line1}, ${line2}${cityState} ${row.zip_code ?? ""}`.trim();
}

export default async function StaffDirectoryPage({
  searchParams,
}: {
  // `string | string[]`, not just `string` — see roles/page.tsx's comment on
  // the same pattern: a repeated query key must not 500 the page.
  searchParams: Promise<{ q?: string | string[]; weapon?: string | string[]; allSeasons?: string | string[] }>;
}) {
  const { q, weapon, allSeasons } = await searchParams;
  const rawQuery = Array.isArray(q) ? q[0] : q;
  const rawWeapon = Array.isArray(weapon) ? weapon[0] : weapon;
  const rawAllSeasons = Array.isArray(allSeasons) ? allSeasons[0] : allSeasons;

  const query = rawQuery?.trim() ?? "";
  const weaponFilter = rawWeapon && rawWeapon !== "all" ? rawWeapon : null;
  const showAllSeasons = rawAllSeasons === "1";

  const supabase = await createSessionClient();
  const { data, error } = await supabase.rpc("staff_member_directory", {
    p_query: query.length > 0 ? query : null,
    p_weapon: weaponFilter,
    p_season: showAllSeasons ? null : MEMBERSHIP_SEASON,
  });

  if (error) {
    throw new Error(error.message);
  }

  const members = (data ?? []) as DirectoryRow[];

  return (
    <Section className="print:py-0">
      <div className="flex items-start justify-between gap-4 flex-wrap print:hidden">
        <div>
          <Eyebrow>Staff</Eyebrow>
          <h1 className="mt-4 text-[clamp(32px,5vw,56px)] leading-[1.05]">Member directory</h1>
          <p className="mt-4 text-mute max-w-xl leading-relaxed">
            Contact info, emergency contacts, and class enrollment for every
            member on the club. Sex at birth, signed waivers, and medical
            notes are not shown here — medical notes will likely return once
            we have a secure way to surface them.
          </p>
        </div>
        <PrintDirectoryButton />
      </div>

      <StripRule className="mt-12 mb-8 print:hidden" />

      {/* Plain GET form: no client JS, submits on Enter, state lives in the
          URL so results survive a refresh and can be linked or printed. */}
      <form
        action="/member/staff/directory"
        method="get"
        className="max-w-3xl mb-8 flex gap-3 flex-wrap items-end print:hidden"
      >
        <div className="flex-1 min-w-[220px]">
          <label htmlFor="q" className="block text-xs font-semibold uppercase tracking-[0.12em] text-mute mb-2">
            Search by name or email
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Smith, or pat@example.com"
            className="w-full bg-white border border-rule px-3 py-2.5 text-[15px] text-ink placeholder:text-mute/60 focus:outline-none focus:ring-0 focus:border-brass transition-colors duration-150"
          />
        </div>
        <div>
          <label htmlFor="weapon" className="block text-xs font-semibold uppercase tracking-[0.12em] text-mute mb-2">
            Weapon
          </label>
          <select
            id="weapon"
            name="weapon"
            defaultValue={weaponFilter ?? "all"}
            className="bg-white border border-rule px-3 py-2.5 text-[15px] text-ink focus:outline-none focus:ring-0 focus:border-brass transition-colors duration-150"
          >
            <option value="all">All weapons</option>
            <option value="foil-youth">Foil (Youth)</option>
            <option value="foil-adult">Foil (Adult)</option>
            <option value="epee">Epee</option>
            <option value="saber">Saber</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-mute pb-2.5 cursor-pointer">
          <input type="checkbox" name="allSeasons" value="1" defaultChecked={showAllSeasons} />
          All seasons (not just {MEMBERSHIP_SEASON})
        </label>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-semibold uppercase tracking-[0.1em] bg-purple-950 text-bone rounded-[2px] hover:bg-purple-800 transition-colors"
        >
          Search
        </button>
        {(query.length > 0 || weaponFilter || showAllSeasons) && (
          <a href="/member/staff/directory" className="text-sm text-mute hover:text-ink underline transition-colors pb-2.5">
            Clear
          </a>
        )}
      </form>

      <p className="text-sm text-mute mb-8 max-w-3xl print:hidden">
        {members.length} member{members.length === 1 ? "" : "s"}
        {showAllSeasons ? "" : ` in ${MEMBERSHIP_SEASON}`}.
      </p>

      {members.length === 0 ? (
        <p className="text-mute">No members match that search.</p>
      ) : (
        <ul className="flex flex-col gap-4 max-w-3xl print:max-w-none">
          {members.map((member) => {
            const address = formatAddress(member);
            const weapons = formatWeapons(member.weapon_classes);
            const hasGuardianContact = member.guardian_first_name || member.guardian_phone;

            return (
              <li
                key={member.id}
                className="border border-brass/25 rounded-[4px] p-5 print:border-black/40 print:break-inside-avoid"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-semibold text-ink">
                      {member.first_name} {member.last_name}
                    </p>
                    <p className="text-xs text-mute uppercase tracking-[0.08em] mt-0.5">
                      {PERSON_TYPE_LABELS[member.person_type]}
                      {weapons ? ` · ${weapons}` : ""}
                      {member.membership_season ? ` · ${member.membership_season}` : ""}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <p className="text-ink">{member.contact_email}</p>
                  <p className="text-mute tabular">{member.contact_phone}</p>
                  {address && <p className="text-mute sm:col-span-2">{address}</p>}
                  {hasGuardianContact && (
                    <p className="text-mute sm:col-span-2">
                      Guardian: {member.guardian_first_name} {member.guardian_last_name}
                      {member.guardian_relationship ? ` (${member.guardian_relationship})` : ""}
                      {member.guardian_phone ? ` · ${member.guardian_phone}` : ""}
                    </p>
                  )}
                </div>

                {member.emergency_contacts.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-rule text-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-mute mb-1">
                      Emergency contacts
                    </p>
                    {member.emergency_contacts.map((ec) => (
                      <p key={ec.contact_order} className="text-mute">
                        {ec.first_name} {ec.last_name} ({ec.relationship}) · {ec.phone}
                        {ec.email ? ` · ${ec.email}` : ""}
                      </p>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSessionClient } from "@/lib/supabase-server";
import { Section } from "@/components/Section";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { Card } from "@/components/Card";
import { signOut } from "./actions";
import type { MemberSummary, WeaponClass } from "@/lib/member-types";
import { isMinor } from "@/lib/age";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Member Dashboard",
  description: "Your Des Moines Fencing Club member dashboard.",
};

const WEAPON_LABELS: Record<WeaponClass, string> = {
  "foil-youth": "Foil (Youth)",
  "foil-adult": "Foil (Adult)",
  epee: "Epee",
  saber: "Saber",
};

function formatWeapons(classes: WeaponClass[]): string {
  if (!classes || classes.length === 0) return "---";
  return classes.map((c) => WEAPON_LABELS[c] ?? c).join(" · ");
}

function formatSeason(season: string | null): string {
  if (!season) return "---";
  return season.replace("-", "–");
}

// Resolves the dashboard greeting to the account HOLDER's name, not simply
// the first profile's — `profiles` rows are athletes (plus, as of M1,
// lazily-created guardian rows per VOLUNTEERS.md D3), and the first one
// created on an account is not necessarily the adult who is signed in. This
// replaces the old `members[0].first_name`, which greeted a fencing parent
// with their child's first name. Preference order, per VOLUNTEERS.md M1:
//   1. A guardian profile on the account whose `contact_email` matches the
//      signed-in login's email; else any guardian profile.
//   2. An adult (non-minor) athlete profile.
//   3. `guardian_first_name` captured on any minor athlete's row.
//   4. No name resolves — the caller falls back to a neutral greeting.
//
// Step 1 checks email before falling back to "just take the first guardian"
// because, once M3 ships lazy guardian-profile creation, a single account
// can hold *several* guardian rows — the candidate algorithm in
// VOLUNTEERS.md explicitly supports two parents (Mom seeded from one
// child's row, Dad from another) plus a grandparent added via "Someone
// else…". Picking whichever guardian row happens to sort first by
// `created_at` would greet the signed-in parent with someone else's name.
// A guardian row's `contact_email` is seeded from `auth.users.email` at
// creation (D3), so a case-insensitive match against the signed-in user's
// email reliably identifies "the guardian who is this login" — a
// grandparent added through "Someone else…" carries a different email (or
// none) and won't false-positive.
function resolveOwnerName(
  members: MemberSummary[],
  userEmail: string | null | undefined
): string | null {
  const guardians = members.filter((m) => m.person_type === "guardian");
  if (guardians.length > 0) {
    const normalizedUserEmail = userEmail?.toLowerCase();
    const signedInGuardian = guardians.find(
      (g) =>
        normalizedUserEmail &&
        g.contact_email.toLowerCase() === normalizedUserEmail
    );
    return (signedInGuardian ?? guardians[0]).first_name;
  }

  const adultAthlete = members.find(
    (m) => m.person_type === "athlete" && !isMinor(m.birthday)
  );
  if (adultAthlete) return adultAthlete.first_name;

  const minorWithGuardianName = members.find(
    (m) => m.person_type === "athlete" && m.guardian_first_name
  );
  if (minorWithGuardianName) return minorWithGuardianName.guardian_first_name;

  return null;
}

type PortalLink = {
  href: string;
  label: string;
  description: string;
};

const portalLinks: PortalLink[] = [
  {
    href: "/classes",
    label: "Class schedule",
    description: "Current session times, weapons, and age groups.",
  },
  {
    href: "/news",
    label: "Club news",
    description: "Announcements, tournament results, and updates.",
  },
];

export default async function MemberDashboardPage() {
  const supabase = await createSessionClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/member");
  }

  const { data: members, error: membersError } = await supabase
    .from("profiles")
    .select(
      "id, person_type, first_name, last_name, birthday, weapon_classes, membership_season, enrollment_complete, guardian_first_name, contact_email"
    )
    .eq("account_owner_id", user.id)
    .order("created_at", { ascending: true })
    .returns<MemberSummary[]>();

  // A DB error here is not "no members" — surface it instead of silently
  // falling through to the first-enrollment redirect below, which would let
  // an existing member create a duplicate profile.
  if (membersError) {
    throw new Error(membersError.message);
  }

  // No members yet → start the first enrollment.
  if (!members || members.length === 0) {
    redirect("/member/enroll");
  }

  // Guardian rows (person_type = 'guardian') are adults on the account with
  // no season/enrollment data of their own — created lazily on first
  // volunteer signup (VOLUNTEERS.md D3). They render in their own lighter
  // block below, not as member cards with empty season badges.
  const athletes = members.filter((m) => m.person_type === "athlete");
  const guardians = members.filter((m) => m.person_type === "guardian");

  const ownerName = resolveOwnerName(members, user.email);

  return (
    <Section>
      <Eyebrow>Member Dashboard</Eyebrow>

      <h1 className="mt-4 text-[clamp(40px,6vw,80px)] leading-[1.05]">
        {ownerName ? (
          <>
            Welcome back, <span className="italic">{ownerName}.</span>
          </>
        ) : (
          <>Welcome back.</>
        )}
      </h1>

      <StripRule className="mt-12 mb-12" />

      <div className="flex items-end justify-between gap-4 flex-wrap max-w-2xl mb-8">
        <h2 className="text-[clamp(22px,3vw,32px)] leading-tight">
          Members on your account
        </h2>
        <Link
          href="/member/enroll"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold uppercase tracking-[0.1em] bg-purple-950 text-bone rounded-[2px] hover:bg-purple-800 transition-colors"
        >
          <span aria-hidden="true" className="text-brass text-base leading-none">
            +
          </span>
          Add a member
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 max-w-2xl">
        {athletes.map((member) => (
          <div
            key={member.id}
            className="bg-purple-950 text-bone rounded-[4px] p-8 md:p-10"
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brass mb-3">
                  Des Moines Fencing Club
                </p>
                <p className="font-display text-[clamp(24px,4vw,36px)] leading-tight">
                  {member.first_name} {member.last_name}
                </p>
              </div>
              <span
                className={`inline-flex items-center px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] rounded-[2px] self-start ${
                  member.enrollment_complete
                    ? "bg-brass text-ink"
                    : "border border-bone/40 text-bone/70"
                }`}
              >
                {member.enrollment_complete ? "Active Member" : "Incomplete"}
              </span>
            </div>

            <div className="mt-8 pt-6 border-t border-bone/20 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-bone/50 mb-1">
                  Season
                </p>
                <p className="text-bone font-medium tabular">
                  {formatSeason(member.membership_season)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-bone/50 mb-1">
                  Weapon classes
                </p>
                <p className="text-bone font-medium">
                  {formatWeapons(member.weapon_classes)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-bone/50 mb-1">
                  Category
                </p>
                <p className="text-bone font-medium">
                  {isMinor(member.birthday) ? "Minor" : "Adult"}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-bone/20">
              <Link
                href={`/member/enroll?member=${member.id}`}
                className="text-sm font-semibold text-brass hover:text-bone transition-colors"
              >
                {member.enrollment_complete
                  ? "Update information →"
                  : "Finish enrollment →"}
              </Link>
            </div>
          </div>
        ))}
      </div>

      {guardians.length > 0 && (
        <>
          <StripRule className="mt-16 mb-12" />

          <h2 className="text-[clamp(22px,3vw,32px)] leading-tight mb-8">
            Adults on this account
          </h2>

          {/* Deliberately lighter than the purple-950 member cards above —
              a guardian isn't a fencer with a season badge, just a named
              adult available to volunteer. Card is the DESIGN.md-standard
              hairline surface, not a second member-card treatment. */}
          <div className="grid grid-cols-1 gap-4 max-w-2xl">
            {guardians.map((guardian) => (
              <Card key={guardian.id} className="!p-6 md:!p-8">
                <p className="font-display text-lg text-ink">
                  {guardian.first_name} {guardian.last_name}
                </p>
              </Card>
            ))}
          </div>
        </>
      )}

      <StripRule className="mt-16 mb-12" />

      <div className="max-w-2xl">
        <h2 className="text-[clamp(22px,3vw,32px)] leading-tight mb-8">
          Member portal
        </h2>
        <ul className="space-y-0 divide-y divide-rule">
          {portalLinks.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex items-start justify-between gap-6 py-5 hover:text-purple-700 transition-colors"
              >
                <div>
                  <p className="font-semibold text-ink group-hover:text-purple-700 transition-colors">
                    {item.label}
                  </p>
                  <p className="text-sm text-mute mt-0.5 leading-relaxed">
                    {item.description}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className="text-brass mt-0.5 flex-shrink-0 text-lg"
                >
                  &#8594;
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <StripRule className="mt-12 mb-8" />

      <form action={signOut}>
        <button
          type="submit"
          className="text-sm text-mute hover:text-ink underline transition-colors"
        >
          Sign out
        </button>
      </form>
    </Section>
  );
}

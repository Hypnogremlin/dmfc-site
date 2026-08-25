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
import { hasRoleAtLeast } from "@/lib/roles";
import { upcomingCutoffIso } from "@/lib/volunteer/datetime";
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
// with their child's first name.
//
// Preference order — deliberately ranked by how *confident* each signal is
// that the name belongs to the person signed in right now, not just by
// "guardian beats athlete" or vice versa:
//   1. A guardian row whose `contact_email` matches the signed-in login
//      (case-insensitive). Strong signal — a guardian row's contact_email is
//      seeded from `auth.users.email` at lazy creation time (D3), so this
//      row *is* the person signed in.
//   2. An adult (non-minor) athlete profile. Also a strong signal — the
//      login's own fencing record.
//   3. Any remaining guardian row. Weak fallback only: once M3 ships lazy
//      guardian creation, an account can hold *several* guardian rows (two
//      parents split across siblings' `guardian_*` data, or one added via
//      "Someone else…" carrying its own email). Falling to an arbitrary one
//      of those is a guess, not a confirmation — it must lose to tier 2. An
//      adult athlete's own record is a better answer than "some guardian on
//      this account" when the account holder also fences.
//   4. `guardian_first_name` captured on any minor athlete's row.
//   5. No name resolves — the caller falls back to a neutral greeting.
//
// Do not "simplify" this by hoisting the guardian check above the athlete
// check — that regresses to matching by whichever guardian sorts first,
// which can greet an adult athlete who owns the account by a different
// guardian's name entirely (e.g. their spouse's, if hers was added via
// "Someone else…" with her own email and his athlete profile has no email
// match to offer).
function resolveOwnerName(
  members: MemberSummary[],
  userEmail: string | null | undefined
): string | null {
  const guardians = members.filter((m) => m.person_type === "guardian");

  const normalizedUserEmail = userEmail?.toLowerCase();
  const signedInGuardian = guardians.find(
    (g) =>
      normalizedUserEmail && g.contact_email.toLowerCase() === normalizedUserEmail
  );
  if (signedInGuardian) return signedInGuardian.first_name;

  const adultAthlete = members.find(
    (m) => m.person_type === "athlete" && !isMinor(m.birthday)
  );
  if (adultAthlete) return adultAthlete.first_name;

  if (guardians.length > 0) return guardians[0].first_name;

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
  badge?: number;
};

// Static entries. Volunteer (with its unread badge) and Staff dashboard
// (role-gated) are appended dynamically in the component below, since both
// depend on data this array can't see.
const staticPortalLinks: PortalLink[] = [
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

  // D10: "new" is any published request the member hasn't seen since it went
  // live. Compared against published_at, not created_at — a coach commonly
  // creates a draft days before publishing it (M2's whole draft/publish
  // split exists for this), and keying off created_at meant the badge never
  // fired for the normal case of "drafted before your last visit, published
  // after it." NULL (never visited /member/volunteer) counts everything
  // published as new, rather than nothing — a fresh account shouldn't have
  // to guess whether requests already exist. Also excludes events that have
  // already happened, via the same upcomingCutoffIso() the volunteer list
  // page filters on, so a never-visited account isn't badged with every
  // request the club has ever published.
  const [{ data: settings, error: settingsError }, isStaff] = await Promise.all([
    supabase.from("account_settings").select("volunteer_last_seen_at").eq("id", user.id).maybeSingle(),
    hasRoleAtLeast("coach"),
  ]);

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  const { count: newVolunteerCount, error: countError } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .eq("published", true)
    .gte("starts_at", upcomingCutoffIso())
    .gt("published_at", settings?.volunteer_last_seen_at ?? "1970-01-01T00:00:00Z");

  if (countError) {
    throw new Error(countError.message);
  }

  const portalLinks: PortalLink[] = [
    {
      href: "/member/volunteer",
      label: "Volunteer",
      description: "Sign up to help out at upcoming events.",
      badge: newVolunteerCount ?? 0,
    },
    ...(isStaff
      ? [
          {
            href: "/member/staff/events",
            label: "Staff dashboard",
            description: "Create and publish volunteer requests.",
          },
        ]
      : []),
    ...staticPortalLinks,
  ];

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
                  <p className="font-semibold text-ink group-hover:text-purple-700 transition-colors flex items-center gap-2">
                    {item.label}
                    {!!item.badge && (
                      <span className="inline-flex items-center justify-center min-w-[1.5em] h-[1.5em] px-1.5 text-xs font-semibold rounded-full bg-brass text-ink">
                        {item.badge}
                      </span>
                    )}
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

      <StripRule className="mt-16 mb-12" />

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

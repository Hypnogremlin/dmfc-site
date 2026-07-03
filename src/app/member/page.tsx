import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSessionClient } from "@/lib/supabase-server";
import { Section } from "@/components/Section";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { signOut } from "./actions";
import type { MemberSummary, WeaponClass } from "@/lib/member-types";
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

function isMinor(birthday: string): boolean {
  if (!birthday) return false;
  const today = new Date();
  const dob = new Date(birthday);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age < 18;
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

  const { data: members } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, birthday, weapon_classes, membership_season, enrollment_complete"
    )
    .eq("account_owner_id", user.id)
    .order("created_at", { ascending: true })
    .returns<MemberSummary[]>();

  // No members yet → start the first enrollment.
  if (!members || members.length === 0) {
    redirect("/member/enroll");
  }

  const ownerName = members[0].first_name;

  return (
    <Section>
      <Eyebrow>Member Dashboard</Eyebrow>

      <h1 className="mt-4 text-[clamp(40px,6vw,80px)] leading-[1.05]">
        Welcome back,{" "}
        <span className="italic">{ownerName}.</span>
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
        {members.map((member) => (
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

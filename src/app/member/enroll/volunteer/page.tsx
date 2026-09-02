import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSessionClient } from "@/lib/supabase-server";
import { Section } from "@/components/Section";
import { Eyebrow } from "@/components/Eyebrow";
import { VolunteerProfileForm } from "./VolunteerProfileForm";

export const metadata: Metadata = {
  title: "Set up a non-athlete account",
};

// Self-serve non-athlete signup (VOLUNTEERS.md D14) — for a board member,
// alum, or supporter who is not fencing and should never be asked for a
// birthday, an address, or six waivers.
//
// Reached from a link under the athlete form on /member/enroll, shown only in
// its first-enrollment mode. Deliberately self-serve rather than invite-only:
// magic-link signup is already open, so an invite flow would build a mechanism
// to solve a problem that does not exist, and could not be tested on a preview
// deploy at all (the magic-link email hard-codes production's site_url).
//
// It grants nothing. A profile created here carries role = 'member' and no
// capability beyond any other member; every elevation still requires an admin
// acting in /member/staff/roles.
export default async function VolunteerEnrollPage() {
  const supabase = await createSessionClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/member/enroll/volunteer");
  }

  const { data: existing, error } = await supabase
    .from("profiles")
    .select("id, person_type")
    .eq("account_owner_id", user.id);

  // A read failure is not "no profiles" — surfacing it beats letting someone
  // create a duplicate record, the same distinction /member draws.
  if (error) {
    throw new Error(error.message);
  }

  // Already has a supporter record — nothing to do here.
  if (existing?.some((p) => p.person_type === "volunteer")) {
    redirect("/member");
  }

  return (
    <Section>
      <div className="mb-12">
        <Eyebrow>Non-athlete account</Eyebrow>
        <h1 className="mt-4 text-[clamp(36px,5vw,64px)] leading-[1.05]">
          Set up your
          <br />
          <span className="italic">club profile.</span>
        </h1>
        <p className="mt-4 text-mute max-w-xl leading-relaxed">
          For board members, alumni, and supporters who help out but
          aren&apos;t fencing. Just your name and how to reach you — no
          waivers, no membership forms. You can enroll a fencer later if that
          changes.
        </p>
      </div>

      <VolunteerProfileForm userEmail={user.email ?? ""} />
    </Section>
  );
}

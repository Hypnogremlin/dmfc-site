import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSessionClient } from "@/lib/supabase-server";
import { Section } from "@/components/Section";
import { Eyebrow } from "@/components/Eyebrow";
import { EnrollClient } from "./EnrollClient";

export const metadata: Metadata = {
  title: "Complete Your Membership",
  description: "Fill out your membership details to complete enrollment with the Des Moines Fencing Club.",
};

export default async function EnrollPage() {
  const supabase = await createSessionClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/member/enroll");
  }

  // Check if already enrolled
  const { data: profile } = await supabase
    .from("profiles")
    .select("enrollment_complete")
    .eq("id", user.id)
    .single();

  if (profile?.enrollment_complete) {
    redirect("/member");
  }

  return (
    <Section>
      <div className="mb-12">
        <Eyebrow>Membership enrollment</Eyebrow>
        <h1 className="mt-4 text-[clamp(36px,5vw,64px)] leading-[1.05]">
          Complete your
          <br />
          <span className="italic">membership.</span>
        </h1>
      </div>

      <EnrollClient userEmail={user.email ?? ""} />
    </Section>
  );
}

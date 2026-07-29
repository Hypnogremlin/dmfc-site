import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSessionClient } from "@/lib/supabase-server";
import { Section } from "@/components/Section";
import { Eyebrow } from "@/components/Eyebrow";
import { EnrollClient } from "./EnrollClient";
import type {
  MembershipFormData,
  Profile,
  EmergencyContact,
  MemberMedical,
  MemberWaiver,
} from "@/lib/member-types";
import { MEMBERSHIP_SEASON } from "@/lib/member-types";

export const metadata: Metadata = {
  title: "Complete Your Membership",
  description: "Fill out your membership details to complete enrollment with the Des Moines Fencing Club.",
};

// Shared household fields copied onto a new member from the account's most
// recent member (contact, address, emergency contacts) to cut re-typing.
function sharedDefaults(
  latest: Profile,
  contacts: EmergencyContact[]
): Partial<MembershipFormData> {
  const ec1 = contacts.find((c) => c.contact_order === 1);
  const ec2 = contacts.find((c) => c.contact_order === 2);
  return {
    contact_phone: latest.contact_phone ?? "",
    address_line1: latest.address_line1 ?? "",
    address_line2: latest.address_line2 ?? "",
    city: latest.city ?? "",
    state: latest.state ?? "",
    zip_code: latest.zip_code ?? "",
    ...(ec1
      ? {
          ec1_last_name: ec1.last_name ?? "",
          ec1_first_name: ec1.first_name ?? "",
          ec1_relationship: ec1.relationship ?? "",
          ec1_email: ec1.email ?? "",
          ec1_phone: ec1.phone ?? "",
          ec1_address_line1: ec1.address_line1 ?? "",
          ec1_address_line2: ec1.address_line2 ?? "",
          ec1_city: ec1.city ?? "",
          ec1_state: ec1.state ?? "",
          ec1_zip_code: ec1.zip_code ?? "",
        }
      : {}),
    ...(ec2
      ? {
          ec2_last_name: ec2.last_name ?? "",
          ec2_first_name: ec2.first_name ?? "",
          ec2_relationship: ec2.relationship ?? "",
          ec2_email: ec2.email ?? "",
          ec2_email_2: ec2.email_2 ?? "",
          ec2_phone: ec2.phone ?? "",
          ec2_phone_2: ec2.phone_2 ?? "",
          ec2_address_line1: ec2.address_line1 ?? "",
          ec2_address_line2: ec2.address_line2 ?? "",
          ec2_city: ec2.city ?? "",
          ec2_state: ec2.state ?? "",
          ec2_zip_code: ec2.zip_code ?? "",
        }
      : {}),
  };
}

// A member's full record mapped back onto the form for editing / resuming.
function fullDefaults(
  profile: Profile,
  contacts: EmergencyContact[],
  medical: MemberMedical | null,
  waiver: MemberWaiver | null
): Partial<MembershipFormData> {
  return {
    first_name: profile.first_name ?? "",
    last_name: profile.last_name ?? "",
    birthday: profile.birthday ?? "",
    usa_citizen: profile.usa_citizen ?? true,
    sex_at_birth: profile.sex_at_birth ?? "",
    gender_identity: profile.gender_identity ?? "",
    weapon_classes: profile.weapon_classes ?? [],
    shirt_size: profile.shirt_size ?? "",
    guardian_first_name: profile.guardian_first_name ?? "",
    guardian_last_name: profile.guardian_last_name ?? "",
    guardian_relationship: profile.guardian_relationship ?? "",
    guardian_phone: profile.guardian_phone ?? "",
    ...sharedDefaults(profile, contacts),
    ...(medical
      ? {
          medical_conditions: medical.medical_conditions ?? "",
          preferred_medical_system: medical.preferred_medical_system ?? "",
        }
      : {}),
    ...(waiver
      ? {
          rules_club_athlete_agreed: waiver.rules_club_athlete_agreed,
          rules_club_athlete_signature: waiver.rules_club_athlete_signature ?? "",
          rules_club_guardian_agreed: waiver.rules_club_guardian_agreed,
          rules_club_guardian_signature: waiver.rules_club_guardian_signature ?? "",
          athlete_coc_agreed: waiver.athlete_coc_agreed,
          athlete_coc_signature: waiver.athlete_coc_signature ?? "",
          parent_coc_agreed: waiver.parent_coc_agreed,
          parent_coc_signature: waiver.parent_coc_signature ?? "",
          individual_waiver_agreed: waiver.individual_waiver_agreed,
          individual_waiver_signature: waiver.individual_waiver_signature ?? "",
          maapp_agreed: waiver.maapp_agreed,
          maapp_signature: waiver.maapp_signature ?? "",
          photo_release_agreed: waiver.photo_release_agreed,
          photo_release_signature: waiver.photo_release_signature ?? "",
        }
      : {}),
  };
}

async function loadMemberChildren(
  supabase: SupabaseClient,
  profileId: string
): Promise<{
  contacts: EmergencyContact[];
  medical: MemberMedical | null;
  waiver: MemberWaiver | null;
}> {
  const [
    { data: contacts, error: contactsError },
    { data: medical, error: medicalError },
    { data: waiver, error: waiverError },
  ] = await Promise.all([
    supabase
      .from("emergency_contacts")
      .select("*")
      .eq("profile_id", profileId),
    supabase
      .from("member_medical")
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle(),
    supabase
      .from("member_waivers")
      .select("*")
      .eq("profile_id", profileId)
      .eq("season_year", MEMBERSHIP_SEASON)
      .maybeSingle(),
  ]);

  if (contactsError || medicalError || waiverError) {
    throw new Error("Failed to load member data.");
  }

  return {
    contacts: (contacts as EmergencyContact[]) ?? [],
    medical: (medical as MemberMedical | null) ?? null,
    waiver: (waiver as MemberWaiver | null) ?? null,
  };
}

export default async function EnrollPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const { member: memberId } = await searchParams;
  const supabase = await createSessionClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = memberId
      ? `/member/enroll?member=${memberId}`
      : "/member/enroll";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const { data: members, error: membersError } = await supabase
    .from("profiles")
    .select("*")
    .eq("account_owner_id", user.id)
    .order("created_at", { ascending: true })
    .returns<Profile[]>();

  // A DB error here is not "no members" — surface it instead of silently
  // falling through to "first enrollment" mode, which would let an existing
  // member create a duplicate profile.
  if (membersError) {
    throw new Error(membersError.message);
  }

  // This form is athlete-only — birthday, sex at birth, address, and waivers
  // all assume a fencer. A guardian row (person_type = 'guardian', created
  // lazily on first volunteer signup per VOLUNTEERS.md D3) has none of that
  // and must never be loaded into it, edited through it, or used as the
  // "latest member" template for a new sibling.
  const athletes = (members ?? []).filter((m) => m.person_type === "athlete");

  let defaults: Partial<MembershipFormData> | undefined;
  let profileId: string | undefined;
  let mode: "first" | "add" | "edit" = "first";

  if (memberId) {
    // Edit / resume an existing member (must belong to this owner and be an
    // athlete). Not-found and wrong-person-type both bounce the same way a
    // mismatched id already does above them — there's nothing for either
    // case to recover into on this form.
    const target = athletes.find((m) => m.id === memberId);
    if (!target) {
      redirect("/member");
    }
    profileId = target.id;
    mode = "edit";
    const { contacts, medical, waiver } = await loadMemberChildren(
      supabase,
      target.id
    );
    defaults = fullDefaults(target, contacts, medical, waiver);
  } else if (athletes.length > 0) {
    // Adding another member — pre-fill shared household fields.
    mode = "add";
    const latest = athletes[athletes.length - 1];
    const { contacts } = await loadMemberChildren(supabase, latest.id);
    defaults = sharedDefaults(latest, contacts);
  }

  const heading =
    mode === "edit"
      ? { eyebrow: "Update member", title: "member details." }
      : mode === "add"
      ? { eyebrow: "Add a member", title: "family member." }
      : { eyebrow: "Membership enrollment", title: "membership." };

  return (
    <Section>
      <div className="mb-12">
        <Eyebrow>{heading.eyebrow}</Eyebrow>
        <h1 className="mt-4 text-[clamp(36px,5vw,64px)] leading-[1.05]">
          {mode === "edit" ? "Update" : mode === "add" ? "Add a" : "Complete your"}
          <br />
          <span className="italic">{heading.title}</span>
        </h1>
        {mode === "first" && (
          <p className="mt-4 text-mute max-w-xl leading-relaxed">
            Use a parent or guardian&apos;s email for the account — you can add
            more family members (children or another adult) once you&apos;re in.
          </p>
        )}
      </div>

      <EnrollClient
        userEmail={user.email ?? ""}
        defaults={defaults}
        profileId={profileId}
      />
    </Section>
  );
}

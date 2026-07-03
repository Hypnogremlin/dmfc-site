"use client";

import { useRouter } from "next/navigation";
import { MembershipForm } from "@/components/membership/MembershipForm";
import { submitMembershipForm } from "@/app/member/actions";
import type { MembershipFormData } from "@/lib/member-types";

interface EnrollClientProps {
  userEmail: string;
  // Pre-filled field values: shared contact/address when adding a new member,
  // or the member's full record when editing.
  defaults?: Partial<MembershipFormData>;
  // When set, the form edits this existing member instead of creating one.
  profileId?: string;
}

export function EnrollClient({ userEmail, defaults, profileId }: EnrollClientProps) {
  const router = useRouter();

  async function handleSubmit(data: MembershipFormData) {
    const result = await submitMembershipForm(data, profileId);
    if (result.ok) {
      router.push("/member");
    }
    return result;
  }

  return (
    <MembershipForm
      userEmail={userEmail}
      defaults={defaults}
      onSubmit={handleSubmit}
    />
  );
}

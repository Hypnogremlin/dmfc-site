"use client";

import { useRouter } from "next/navigation";
import { MembershipForm } from "@/components/membership/MembershipForm";
import { submitMembershipForm } from "@/app/member/actions";
import type { MembershipFormData } from "@/lib/member-types";

interface EnrollClientProps {
  userEmail: string;
}

export function EnrollClient({ userEmail }: EnrollClientProps) {
  const router = useRouter();

  async function handleSubmit(data: MembershipFormData) {
    const result = await submitMembershipForm(data);
    if (result.ok) {
      router.push("/member");
    }
    return result;
  }

  return (
    <MembershipForm
      userEmail={userEmail}
      onSubmit={handleSubmit}
    />
  );
}

import { ReactNode } from "react";
import { assertRole } from "@/lib/roles";

// Tightens the parent staff gate from 'coach' to 'admin'. Both layouts fire —
// src/app/member/staff/layout.tsx asserts coach first, this one narrows.
//
// Like that one, this is UX, not the security boundary: it decides what a
// browser renders, nothing more. Every action in ./actions.ts re-asserts, and
// admin_account_list() checks has_role_at_least('admin') inside the function
// before it reads a single row. Three layers, because this screen is the
// largest PII surface in the app — every member email in the club.
export default async function RolesLayout({ children }: { children: ReactNode }) {
  await assertRole("admin");
  return <>{children}</>;
}

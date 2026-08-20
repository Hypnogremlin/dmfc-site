import { ReactNode } from "react";
import { assertRole } from "@/lib/roles";

// Gate for every /member/staff/* route. This is the UX check — it redirects
// a member who followed a staff link they can't use back to /member. It is
// NOT the security boundary on its own: every server action under this tree
// independently calls assertRole("coach") again (the real boundary), and RLS
// on `events`/`volunteer_slots` behind that is the final one. See
// VOLUNTEERS.md, "Routes and file layout."
export default async function StaffLayout({ children }: { children: ReactNode }) {
  await assertRole("coach");
  return <>{children}</>;
}

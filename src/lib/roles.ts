// Server-side role helpers for the volunteer system's staff surfaces.
// See VOLUNTEERS.md D5: a login's capability lives on `account_settings`,
// a satellite table on `auth.users` — not on `profiles`, because a profile
// is a person (athlete or guardian), not a login, and "which profile is
// board?" has no answer in a household with five of them.
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase-server";

// Ordered to match the `account_role` enum's declaration order in the M1
// migration (`CREATE TYPE public.account_role AS ENUM ('member', 'coach',
// 'board', 'admin')`). Postgres enums compare by declaration order, and this
// array's index does the same job on the TypeScript side — keep the two in
// sync if the enum ever changes.
export const ACCOUNT_ROLES = ["member", "coach", "board", "admin"] as const;

export type AccountRole = (typeof ACCOUNT_ROLES)[number];

function roleRank(role: AccountRole): number {
  return ACCOUNT_ROLES.indexOf(role);
}

/**
 * Reads the signed-in account's role from `account_settings`.
 *
 * Failure mode, chosen deliberately: this throws — it never falls back to
 * `"member"` on failure, whether the failure is "no session" or a genuine
 * Supabase error. `hasRoleAtLeast`/`assertRole` below are what actually gate
 * server actions (and RLS behind that is the real boundary, per
 * VOLUNTEERS.md), so a caller that can't establish a role must be treated
 * as unauthorized, not quietly downgraded to the lowest role and waved
 * through. Silently defaulting to `"member"` on a DB hiccup is a bug (it
 * hides the outage); silently defaulting to anything higher would be a
 * security hole. The only safe choice when the read fails is to fail
 * closed — throw, and let every caller deny by default. Mirrors the
 * "throw on query errors instead of falling through" comment on the
 * `profiles` query in src/app/member/page.tsx.
 */
export async function getAccountRole(): Promise<AccountRole> {
  const supabase = await createSessionClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("getAccountRole: no signed-in user.");
  }

  const { data, error } = await supabase
    .from("account_settings")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error) {
    throw new Error(
      `getAccountRole: failed to read account_settings for ${user.id}: ${error.message}`
    );
  }

  return data.role as AccountRole;
}

/**
 * True if the signed-in account's role is at least `minRole` in the
 * member < coach < board < admin cascade. Deliberately does not catch
 * `getAccountRole`'s exceptions — a caller gating a write path needs to
 * know the difference between "denied" (returns `false`) and "couldn't
 * tell" (throws), and collapsing the latter into `false` would look
 * identical to a legitimate denial in the logs.
 */
export async function hasRoleAtLeast(minRole: AccountRole): Promise<boolean> {
  const role = await getAccountRole();
  return roleRank(role) >= roleRank(minRole);
}

/**
 * Guards a server action or server component. Redirects to `/member` when
 * the account is authenticated but under-privileged — a normal, expected
 * outcome for a member who followed a staff link they can't use. Does not
 * catch `getAccountRole`'s exceptions (no session, DB error): an
 * unauthenticated caller should hit the calling route's own `/login`
 * redirect rather than a generic `/member` bounce that would mask the real
 * cause, and a DB error should surface as an error rather than be
 * swallowed into a silent redirect.
 */
export async function assertRole(minRole: AccountRole): Promise<void> {
  const ok = await hasRoleAtLeast(minRole);
  if (!ok) {
    redirect("/member");
  }
}

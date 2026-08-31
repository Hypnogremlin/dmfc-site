"use server";

import { revalidatePath } from "next/cache";
import { createSessionClient } from "@/lib/supabase-server";
import { assertRole } from "@/lib/roles";

type ActionResult = { ok: boolean; error?: string };

// Roles an admin may grant from the UI. `admin` is deliberately absent
// (VOLUNTEERS.md D13): it stays hand-granted in SQL, which keeps the set of
// people who can create admins equal to the set of people with database
// access. The database refuses it too — prevent_self_role_change() raises on
// any 'admin' grant carrying a JWT — but this allowlist is the first boundary
// and must not be removed on the assumption that the trigger is enough.
const GRANTABLE_ROLES = ["member", "coach", "board"] as const;

export async function setAccountRole(
  accountId: string,
  // Typed `string`, NOT the narrow union, on purpose. A server action's
  // signature is not a boundary — this argument arrives deserialized off the
  // wire and TypeScript is erased by then. Narrowing it here would make the
  // runtime check below look redundant to the next reader and invite its
  // deletion, which is exactly how the allowlist would stop being enforced.
  role: string
): Promise<ActionResult> {
  await assertRole("admin");

  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not authenticated. Please sign in again." };
  }

  if (accountId === user.id) {
    return {
      ok: false,
      error:
        "You can't change your own role. With one admin account, that would lock the club out of this screen — change it in SQL if you really mean to.",
    };
  }

  if (!(GRANTABLE_ROLES as readonly string[]).includes(role)) {
    // One allowlist check rejects "admin", "superuser", and anything else
    // identically. A denylist here would be a guess about what to exclude.
    return {
      ok: false,
      error: "That role can't be granted here. Admin is set in SQL only.",
    };
  }

  // .neq() mirrors the .eq("person_type","athlete") convention in
  // src/app/member/actions.ts — the check above is UX, this filter is what the
  // database actually executes, so the self-guard survives even if the early
  // return is ever refactored away.
  //
  // role_updated_at / role_updated_by are NOT set here. The role guard trigger
  // stamps them from auth.uid(), because account_settings' RLS lets a member
  // update their own row and an action-set attribution would be forgeable.
  // .maybeSingle(), NOT .single(). `.single()` treats "zero rows" as an error,
  // which meant the friendly not-found message below was unreachable and the
  // raw PostgREST string (PGRST116) reached the UI instead. maybeSingle()
  // returns data === null for zero rows and reserves `error` for real failures.
  const { data, error } = await supabase
    .from("account_settings")
    .update({ role })
    .eq("id", accountId)
    .neq("id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    // Either the account is gone, or it is the caller's own row and the
    // .neq() filtered it out — both mean "nothing was changed."
    return { ok: false, error: "That account no longer exists." };
  }

  revalidatePath("/member/staff/roles");
  return { ok: true };
}

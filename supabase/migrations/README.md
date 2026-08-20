# Supabase Migrations

SQL files here are applied manually via the Supabase SQL Editor:
https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new

Files are named by date. Apply in order.

## Status

| File | Applied to live? |
| --- | --- |
| `20260601023647_create_observation_requests.sql` | Yes |
| `20260616_phase2_membership.sql` | Yes |
| `20260623_waivers_reshape_guardian_usafnum.sql` | Yes |
| `20260629_photo_release.sql` | Yes |
| `20260630_family_accounts.sql` | Yes |
| `20260630_usaf_report_tracking.sql` | Yes |
| `20260703_usaf_citizenship_fields.sql` | Yes |
| `20260704_membership_hardening.sql` | Yes — applied 2026-07-04 via the Supabase MCP (all four parts; Part 2 had previously been applied by hand). Recorded in the remote migration ledger. |
| `20260711_signup_invite_tracking.sql` | Yes — applied 2026-07-11 via the Supabase MCP (`apply_migration`). Recorded in the remote ledger as `20260711160559_signup_invite_tracking`. |
| `20260727_volunteer_foundations.sql` | Yes — applied 2026-07-29 via the Supabase MCP (`apply_migration`) after an independent review pass. Recorded in the remote ledger as `volunteer_foundations`. Verified post-apply (see the file's STATUS header). **Note:** Part 3's `auth.users` trigger uses a `pg_trigger`-guarded conditional `CREATE` rather than this folder's usual `DROP ... IF EXISTS` / `CREATE` pattern — `DROP TRIGGER` needs ownership of `auth.users`, which `postgres` does not have. Do not normalize it. |
| `20260820_volunteer_staff_crud.sql` | Yes — applied 2026-08-20 via the Supabase MCP (`apply_migration`, recorded in the remote ledger as `volunteer_staff_crud`). M2 of the volunteer system: `events` + `volunteer_slots` tables, their RLS policies, an `events_updated_at` trigger (reusing `set_updated_at()` from `20260616_phase2_membership.sql`), and the two `REVOKE`s owed from M1. Verified post-apply: `profiles`/`account_settings` row counts unchanged (57/337); both new tables created empty; 5 policies on `events` and 4 on `volunteer_slots` (no missing `DELETE` policy); both `REVOKE`s confirmed via `has_function_privilege()` (not just the statement's exit status — see the lesson logged below); `has_role_at_least` still callable as required. `get_advisors` shows no findings beyond the pre-existing baseline and the already-accepted "multiple permissive policies" pattern `account_settings` already carries from M1. |

Every file is written to be idempotent, so re-running an already-applied file (or the whole folder from scratch) is safe.

## One stray ledger entry with no local file

The remote ledger contains **`revoke_trigger_function_rpc`** (applied 2026-07-29) with no corresponding file here. That is deliberate: **it is a no-op and should not be reproduced.**

It attempted `REVOKE EXECUTE ON FUNCTION ... FROM anon, authenticated` on the two trigger functions from `20260727_volunteer_foundations.sql`. Postgres grants `EXECUTE` on a new function to the `PUBLIC` pseudo-role automatically, so `anon` and `authenticated` never held a direct grant — the revoke removed nothing, and because revoking a privilege a role does not hold is a no-op rather than an error, it reported success. Verified afterwards: `has_function_privilege()` still returned true for both roles on both functions.

The correct form names `PUBLIC`, and is **pending — to be folded into M2's migration** rather than spent as its own production write (see `VOLUNTEERS.md`):

```sql
REVOKE EXECUTE ON FUNCTION public.handle_new_user_account_settings() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_self_role_change()         FROM PUBLIC;
```

Do **not** revoke `public.has_role_at_least(account_role)` — it is referenced by the `account_settings` RLS policies, and a function used in a policy is evaluated as the *querying* role, so revoking it turns an ordinary member's `SELECT` into a permission error instead of an empty result.

Lesson worth keeping: `REVOKE` reports success when it removes nothing. Always verify a permission change with `has_function_privilege()` / `has_table_privilege()` rather than trusting the statement's exit status.

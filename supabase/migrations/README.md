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
| `20260727_volunteer_foundations.sql` | No — pending owner review. |

Every file is written to be idempotent, so re-running an already-applied file (or the whole folder from scratch) is safe.

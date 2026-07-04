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
| `20260704_membership_hardening.sql` | **Partially.** Only Part 2 (the `observation_requests.weapon` check widening to `foil-youth`/`foil-adult`/`epee`/`saber`) has been applied manually against live. Parts 1, 3, and 4 (RLS `auth.uid()` initplan fix, `profiles.sex_at_birth` CHECK tightening, and the `observation_requests.converted_to_member_id` FK) are **pending** — the owner applies these. |

Every file is written to be idempotent, so re-running an already-applied file (or the whole folder from scratch) is safe.

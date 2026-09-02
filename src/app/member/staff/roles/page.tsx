import type { Metadata } from "next";
import { createSessionClient } from "@/lib/supabase-server";
import { Section } from "@/components/Section";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { candidatesFor, type CandidateProfile } from "@/lib/volunteer/candidates";
import { CLUB_TIME_ZONE } from "@/lib/volunteer/datetime";
import { RoleControl } from "./RoleControl";

export const metadata: Metadata = {
  title: "Staff — Manage Roles",
};

// Shape of one row from admin_account_list(). Hand-typed, matching the RPC's
// RETURNS TABLE in 20260829_roles_and_nonathlete_profiles.sql — this repo has
// no generated Supabase types (see src/lib/volunteer/types.ts).
type AccountRow = {
  account_id: string;
  email: string;
  role: string | null;
  signed_up_at: string;
  last_sign_in_at: string | null;
  role_updated_at: string | null;
  role_updated_by_email: string | null;
  profile_count: number;
  people: CandidateProfile[];
};

// These are audit timestamps (signed up, last signed in, role granted), not
// event times, so they don't go through the formatClub* helpers — the shape
// here has no weekday. They are still pinned to the club's timezone: rendered
// on Vercel (UTC) a grant made at 7pm Central would print as the next day,
// and "when did I make this person a coach" should read in the reader's own
// calendar. Date-only display, so the pin only ever matters near midnight.
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: CLUB_TIME_ZONE,
  });
}

// Turns one account's profile rows into the list of humans behind that login.
//
// This is the whole reason the picker is usable: candidatesFor() reconstructs a
// parent who has no profile of their own from the guardian_* columns on their
// child's row (Patrick, visible only through Michael), and dedupes an adult who
// both fences AND is listed as guardian on three children down to one entry
// instead of four. Reusing it rather than re-deriving names here is deliberate —
// a second resolution path would drift from the volunteer picker's, and then two
// screens would disagree about who is on an account.
function peopleOnAccount(profiles: CandidateProfile[]) {
  return candidatesFor(profiles ?? []).filter((c) => c.kind !== "other");
}

// How many rows we ask for. One more than we intend to show, so "there are
// more" is detectable without a second COUNT query — see RESULT_LIMIT below.
const RESULT_LIMIT = 200;

export default async function ManageRolesPage({
  searchParams,
}: {
  // `string | string[]`, not just `string`: Next supplies an array when a key
  // repeats (`?q=a&q=b`), which a crawler or a doubled submit can produce.
  // Typing it as a bare string let `.trim()` be called on an array — a 500 on
  // a URL that is merely odd.
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const rawQuery = Array.isArray(q) ? q[0] : q;
  const query = rawQuery?.trim() ?? "";
  const searching = query.length > 0;

  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Searching widens to every login, including the ~431 that never enrolled —
  // a board member who signed up but never added a fencer has no identifier
  // except their email, so they are unreachable otherwise. The default view
  // stays narrow because that set is mostly automated signups (see PLAN.md's
  // open-risk note) and burying the real 47 in it makes the screen useless.
  const { data, error } = await supabase.rpc("admin_account_list", {
    p_query: searching ? query : null,
    p_with_people_only: !searching,
    // Ask for one more than we show. If it comes back, we know the result was
    // cut off and can say so — rendering 200 of 300 matches while captioning it
    // "200 accounts" reads as "that's all of them," which is a search tool
    // quietly lying about what it found.
    p_limit: RESULT_LIMIT + 1,
  });

  if (error) {
    throw new Error(error.message);
  }

  const allRows = (data ?? []) as AccountRow[];
  const truncated = allRows.length > RESULT_LIMIT;
  const accounts = truncated ? allRows.slice(0, RESULT_LIMIT) : allRows;

  return (
    <Section>
      <Eyebrow>Staff</Eyebrow>
      <h1 className="mt-4 text-[clamp(32px,5vw,56px)] leading-[1.05]">Manage roles</h1>
      <p className="mt-4 text-mute max-w-xl leading-relaxed">
        Roles belong to a login, not a person — one account can hold a whole
        family. The names below are there so you can tell which login is whose.
        Admin is granted in SQL only.
      </p>

      <StripRule className="mt-12 mb-8" />

      {/* Plain GET form: no client JS, no debounce, submits on Enter. The URL
          carries the state, so it survives the refresh after a role change and
          can be linked to. */}
      <form action="/member/staff/roles" method="get" className="max-w-3xl mb-8">
        <label
          htmlFor="q"
          className="block text-xs font-semibold uppercase tracking-[0.12em] text-mute mb-2"
        >
          Search by name or email
        </label>
        <div className="flex gap-3 flex-wrap">
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Smith, or pat@example.com"
            className="flex-1 min-w-[240px] bg-white border border-rule px-3 py-2.5 text-[15px] text-ink placeholder:text-mute/60 focus:outline-none focus:ring-0 focus:border-brass transition-colors duration-150"
          />
          <button
            type="submit"
            className="px-4 py-2 text-sm font-semibold uppercase tracking-[0.1em] bg-purple-950 text-bone rounded-[2px] hover:bg-purple-800 transition-colors"
          >
            Search
          </button>
          {searching && (
            <a
              href="/member/staff/roles"
              className="self-center text-sm text-mute hover:text-ink underline transition-colors"
            >
              Clear
            </a>
          )}
        </div>
      </form>

      <p className="text-sm text-mute mb-8 max-w-3xl">
        {searching ? (
          <>
            {truncated ? (
              <>
                More than {RESULT_LIMIT} accounts match{" "}
                <span className="text-ink font-medium">{query}</span> — showing
                the first {RESULT_LIMIT}. Narrow your search to see the rest.
              </>
            ) : (
              <>
                {accounts.length} account{accounts.length === 1 ? "" : "s"}{" "}
                matching <span className="text-ink font-medium">{query}</span>.
              </>
            )}{" "}
            Search covers every login, including those with no members enrolled.
          </>
        ) : (
          <>
            Showing {accounts.length} account
            {accounts.length === 1 ? "" : "s"} with members on them. Accounts
            that never enrolled anyone are hidden — search by email to reach one.
          </>
        )}
      </p>

      {accounts.length === 0 ? (
        <p className="text-mute">No accounts match that search.</p>
      ) : (
        <ul className="divide-y divide-rule max-w-3xl">
          {accounts.map((account) => {
            const people = peopleOnAccount(account.people);
            return (
              <li
                key={account.account_id}
                className="py-5 flex items-start justify-between gap-6 flex-wrap"
              >
                <div className="flex-1 min-w-[240px]">
                  {/* Email first: it's the only identifier every account has, and
                      the thing a person can quote back to you. Names below are
                      the disambiguator, not the key. */}
                  <p className="font-semibold text-ink break-all">{account.email}</p>

                  {people.length === 0 ? (
                    <p className="text-sm text-mute mt-1">
                      No members on this account
                      {account.last_sign_in_at
                        ? ""
                        : " · never signed in"}
                    </p>
                  ) : (
                    <p className="text-sm text-mute mt-1">
                      {people.map((person, i) => (
                        <span key={i}>
                          {i > 0 && <span aria-hidden="true"> · </span>}
                          <span className="text-ink">{person.name}</span>
                          {person.kind === "profile" && person.isMinor && " (minor)"}
                          {/* A phantom has no profile row of its own — they exist
                              only as guardian_* data on a child's record. Saying
                              so explains why they can't be clicked into. */}
                          {person.kind === "phantom" && (
                            <>
                              {" "}
                              (
                              {person.relationship
                                ? person.relationship.toLowerCase()
                                : "guardian"}
                              , no profile yet)
                            </>
                          )}
                        </span>
                      ))}
                    </p>
                  )}

                  {account.role_updated_at && (
                    <p className="text-xs text-mute mt-1.5">
                      {account.role} granted
                      {account.role_updated_by_email
                        ? ` by ${account.role_updated_by_email}`
                        : ""}{" "}
                      on {formatDate(account.role_updated_at)}
                    </p>
                  )}
                </div>

                <RoleControl
                  accountId={account.account_id}
                  currentRole={account.role}
                  isSelf={account.account_id === user?.id}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

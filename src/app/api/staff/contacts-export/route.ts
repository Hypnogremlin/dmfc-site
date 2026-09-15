// Coach-and-above download: the current-season roster as a Google Contacts
// import CSV. See src/lib/staff/googleContacts.ts for the format.
//
// ── Why the service client ──────────────────────────────────────────────────
// public.profiles has exactly one RLS policy — "Owners manage their members",
// USING ((select auth.uid()) = account_owner_id). There is no coach-level read
// policy. A session client reading profiles here would therefore return only
// the signed-in coach's own family, silently: no error, just a short CSV that
// looks entirely plausible. So this route reads through the service-role
// client, the same way src/lib/cron/usafReport.ts does.
//
// That bypasses RLS completely, which moves two responsibilities into this
// file:
//
//   1. Authorization. Two independent gates below, both before any member
//      data is read. Do not collapse them into one.
//   2. Column scope. The `select` list IS the allowlist — there is no
//      RETURNS TABLE or policy behind it narrowing what can escape. Never
//      change it to select("*"). sex_at_birth, gender_identity,
//      usa_fencing_number, citizenship/representing country, member_waivers
//      and member_medical are all deliberately absent; medical in particular
//      was removed from the staff directory on purpose in
//      20260901_staff_directory_remove_medical.sql.
//
//      `birthday` is the one sensitive column read here, and it is NOT
//      exported: it exists only to answer "is this athlete an adult", which
//      decides who gets a contact at all. The CSV's Birthday column is always
//      blank — see the column list in src/lib/staff/googleContacts.ts.
import { createSessionClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { hasRoleAtLeast, roleAtLeast, type AccountRole } from "@/lib/roles";
import {
  buildGoogleContactsCsv,
  type ContactExportRow,
} from "@/lib/staff/googleContacts";

// PII, freshly assembled per request — never cache it anywhere.
export const dynamic = "force-dynamic";

export async function GET() {
  // ── Gate 1 — session-scoped role read ─────────────────────────────────────
  // Throws (fail-closed) on no session or on a DB error. Deliberately NOT
  // wrapped in try/catch, per the warnings in src/lib/roles.ts: a catch here
  // would turn a denial into a fall-through. assertRole() is the wrong helper
  // for a route handler — it signals via redirect(), which would answer an
  // API request with a 307 to /member instead of a status code.
  if (!(await hasRoleAtLeast("coach"))) {
    return new Response("Forbidden", { status: 403 });
  }

  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) {
    return new Response("Forbidden", { status: 403 });
  }

  const admin = createServiceClient();

  // ── Gate 2 — independent re-check ─────────────────────────────────────────
  // Same question, different path: keyed off the verified user id and read
  // through the service client rather than the RLS-filtered session client,
  // so the decision to hand over the club's whole contact list does not rest
  // on a single call. Cheap, and this is the highest-PII endpoint in the app.
  const { data: settings, error: roleError } = await admin
    .from("account_settings")
    .select("role")
    .eq("id", user.id)
    .single();

  if (roleError) {
    throw new Error(
      `contacts-export: failed to re-read account_settings for ${user.id}: ${roleError.message}`
    );
  }
  if (!roleAtLeast(settings.role as AccountRole, "coach")) {
    return new Response("Forbidden", { status: 403 });
  }

  // ── Read ──────────────────────────────────────────────────────────────────
  const { data: rows, error } = await admin
    .from("profiles")
    .select(
      "id, account_owner_id, person_type, first_name, last_name, birthday, weapon_classes, " +
        "membership_season, enrollment_complete, contact_email, contact_phone, " +
        "address_line1, address_line2, city, state, zip_code, " +
        "guardian_first_name, guardian_last_name, guardian_relationship, guardian_phone"
    )
    .order("last_name", { ascending: true });

  if (error) {
    throw new Error(`contacts-export: profiles read failed: ${error.message}`);
  }

  // Login emails, so a guardian whose own contact_email differs from the
  // address their household signs in with gets both. Best-effort: if the
  // admin API fails we still export, just without the secondary address —
  // a missing second email is not worth failing the whole download over.
  const accountEmails = new Map<string, string>();
  const { data: userPage, error: usersError } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  if (usersError) {
    console.error("[contacts-export] listUsers failed:", usersError);
  } else {
    for (const u of userPage.users) {
      if (u.email) accountEmails.set(u.id, u.email);
    }
  }

  // Double assertion, same as usafReport.ts: with no generated database types
  // in this repo, the client infers the select string as GenericStringError[].
  const csv = buildGoogleContactsCsv(
    (rows ?? []) as unknown as ContactExportRow[],
    accountEmails
  );

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dmfc-google-contacts-${today}.csv"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

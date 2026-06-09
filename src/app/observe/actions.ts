"use server";

import { createServiceClient } from "@/lib/supabase";
import { generateIcs } from "@/lib/ics";
import { Resend } from "resend";
import { ObservationConfirmation, subject as confirmationSubject } from "@/emails/ObservationConfirmation";
import { ObservationNotification, subject as notificationSubject } from "@/emails/ObservationNotification";
import type { Weapon } from "@/components/ObservationCalendar";

export type ObserveFormData = {
  name: string;
  email: string;
  phone: string;
  role: "athlete" | "parent";
  childName: string;
  partySize: number;
  notes: string;
  sessions: { date: string; weapon: Weapon }[];
};

type ActionResult = { ok: true } | { ok: false; error: string };

export async function submitObservation(data: ObserveFormData): Promise<ActionResult> {
  // 1. Validate
  if (!data.name.trim() || !data.email.trim()) {
    return { ok: false, error: "Name and email are required." };
  }
  if (data.role === "parent" && !data.childName.trim()) {
    return { ok: false, error: "Please enter your child's name." };
  }
  if (!data.sessions || data.sessions.length === 0) {
    return { ok: false, error: "Please select at least one session." };
  }

  // 2. Generate submission ID
  const submission_id = crypto.randomUUID();

  // 3. Build rows — column names match actual Supabase schema
  const rows = data.sessions.map((s) => ({
    submission_id,
    name: data.name,
    email: data.email,
    phone: data.phone || null,
    visitor_type: data.role,
    child_name: data.childName || null,
    party_size: data.partySize,
    notes: data.notes || null,
    visit_date: s.date,
    weapon: s.weapon,
  }));

  // 4. Insert into Supabase
  const supabase = createServiceClient();
  const { error: dbError } = await supabase
    .from("observation_requests")
    .insert(rows);

  if (dbError) {
    console.error("[observe] Supabase insert error:", dbError);
    return { ok: false, error: "Failed to save your request. Please try again." };
  }

  // 5–6. Send emails (non-fatal on failure)
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const FROM = "Des Moines Fencing Club <noreply@emails.desmoinesfencingclub.org>";
    const submittedAt = new Date().toISOString();

    // ICS for visitor confirmation — generic, no personal info
    const attachments = data.sessions.map((s) => ({
      filename: `dmfc-visit-${s.date}-${s.weapon}.ics`,
      content: Buffer.from(generateIcs(s.date, s.weapon)).toString("base64"),
    }));

    // ICS for staff notification — enriched with visitor contact details
    const staffAttachments = data.sessions.map((s) => ({
      filename: `dmfc-visit-${s.date}-${s.weapon}.ics`,
      content: Buffer.from(
        generateIcs(s.date, s.weapon, {
          name: data.name,
          email: data.email,
          phone: data.phone || undefined,
          partySize: data.partySize,
          notes: data.notes || undefined,
        })
      ).toString("base64"),
    }));

    // Weapon-specific routing
    const WEAPON_EMAILS: Record<Weapon, string> = {
      "foil-youth": "dmfcfoil@gmail.com",
      "foil-adult": "dmfcfoil@gmail.com",
      epee: "dmfcepee@gmail.com",
      saber: "dmfcsaber@gmail.com",
    };
    const weaponRecipients = [
      ...new Set(data.sessions.map((s) => WEAPON_EMAILS[s.weapon])),
    ];

    // Notification to club staff (president, coaches, + weapon-specific)
    const { error: notifError } = await resend.emails.send({
      from: FROM,
      to: ["DMFCPresident@gmail.com", "DMFCcoaches@gmail.com", ...weaponRecipients],
      subject: notificationSubject(data.name),
      react: ObservationNotification({
        visitorName: data.name,
        visitorEmail: data.email,
        visitorPhone: data.phone,
        visitorType: data.role,
        childName: data.childName || undefined,
        sessions: data.sessions,
        partySize: data.partySize,
        notes: data.notes || undefined,
        submittedAt,
      }),
      attachments: staffAttachments,
    });
    if (notifError) console.error("[observe] Notification send error:", notifError);

    // Confirmation to visitor
    const firstName = data.name.split(" ")[0];
    const { error: confirmError } = await resend.emails.send({
      from: FROM,
      to: data.email,
      subject: confirmationSubject(firstName),
      react: ObservationConfirmation({
        visitorName: data.name,
        sessions: data.sessions,
        partySize: data.partySize,
        notes: data.notes || undefined,
      }),
      attachments,
    });
    if (confirmError) console.error("[observe] Confirmation send error:", confirmError);
  } catch (emailErr) {
    console.error("[observe] Email send error:", emailErr);
    // Data is saved — return ok regardless
  }

  return { ok: true };
}

"use client";

import { useState, FormEvent } from "react";
import {
  ObservationCalendar,
  type SessionSelection,
  type Weapon,
} from "./ObservationCalendar";

// Dummy (preview-only) /observe form. No submission wiring — submit shows
// a confirmation state and does not store or send anything. Real
// submission, Supabase write, Resend transactional email, and Vercel
// Cron reminder all land in Steps 6–9 of PLAN.md.

const WEAPON_LABELS: Record<Weapon, string> = {
  foil: "Foil",
  epee: "Épée",
  saber: "Saber",
};

function formatSessionLong(s: SessionSelection): string {
  const d = new Date(s.date + "T12:00:00Z");
  const label = d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${label} · ${WEAPON_LABELS[s.weapon]}`;
}

export function ObservationForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"athlete" | "parent">("athlete");
  const [childName, setChildName] = useState("");
  const [partySize, setPartySize] = useState("1");
  const [notes, setNotes] = useState("");
  const [sessions, setSessions] = useState<SessionSelection[]>([]);
  const [submitted, setSubmitted] = useState(false);

  function toggleSession(date: string, weapon: Weapon) {
    setSessions((prev) => {
      const exists = prev.find((s) => s.date === date && s.weapon === weapon);
      if (exists) {
        return prev.filter((s) => !(s.date === date && s.weapon === weapon));
      }
      return [...prev, { date, weapon }].sort((a, b) =>
        a.date < b.date ? -1 : a.date > b.date ? 1 : 0
      );
    });
  }

  function removeSession(s: SessionSelection) {
    setSessions((prev) =>
      prev.filter((x) => !(x.date === s.date && x.weapon === s.weapon))
    );
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="border-2 border-brass p-8 md:p-12 bg-paper">
        <div className="text-brass text-[10px] font-semibold uppercase tracking-[0.16em] mb-3">
          Preview confirmation
        </div>
        <h3 className="font-display text-3xl text-ink leading-tight">
          Thank you, {name || "friend"}.
        </h3>
        <p className="text-ink/75 mt-4 leading-relaxed">
          This is a preview — your request has not been sent. In the real
          version, you would receive a confirmation email with a calendar
          invitation, and a coach would reach out before your visit.
        </p>
        {sessions.length > 0 && (
          <div className="mt-6">
            <div className="text-mute text-xs uppercase tracking-wider mb-2">
              You picked
            </div>
            <ul className="space-y-1 text-ink">
              {sessions.map((s) => (
                <li key={`${s.date}-${s.weapon}`}>{formatSessionLong(s)}</li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-8 text-sm font-semibold uppercase tracking-[0.08em] text-purple-700 underline-draw"
        >
          ← Edit your selection
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      {/* Who is this for? */}
      <fieldset className="space-y-4">
        <Legend>Who is interested in observing?</Legend>
        <div className="flex flex-wrap gap-3">
          <RoleChoice
            value="athlete"
            current={role}
            onChange={setRole}
            label="I am the prospective fencer"
          />
          <RoleChoice
            value="parent"
            current={role}
            onChange={setRole}
            label="I am a parent of a child who's interested"
          />
        </div>
        {role === "parent" && (
          <div className="pt-2">
            <Label htmlFor="childName">Child&apos;s name</Label>
            <Input
              id="childName"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="Child's first name"
            />
          </div>
        )}
      </fieldset>

      <FieldsetDivider />

      {/* Contact info */}
      <fieldset className="space-y-6">
        <Legend>Your contact information</Legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="party">How many people are coming?</Label>
            <Input
              id="party"
              type="number"
              min={1}
              max={10}
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      <FieldsetDivider />

      {/* Calendar */}
      <fieldset className="space-y-4">
        <Legend>Pick the class or classes you&apos;d like to watch</Legend>
        <p className="text-ink/75 text-sm">
          Choose one, two, or all — toggle the letter on a date to add or
          remove that session.
        </p>
        <ObservationCalendar
          selected={sessions}
          onToggle={toggleSession}
        />
        <SelectedSessionsList
          sessions={sessions}
          onRemove={removeSession}
        />
      </fieldset>

      <FieldsetDivider />

      {/* Notes */}
      <fieldset className="space-y-4">
        <Legend>Anything else we should know? (Optional)</Legend>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Questions, accessibility needs, prior experience, etc."
          className="w-full border border-rule bg-paper px-4 py-3 text-ink placeholder:text-mute focus:border-brass focus:outline-none rounded-sm"
        />
      </fieldset>

      <div className="pt-4">
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold uppercase tracking-[0.08em] bg-brass text-ink hover:bg-[oklch(70%_0.17_75)] transition-colors rounded-[3px]"
        >
          Reserve my visit
          <span aria-hidden="true">→</span>
        </button>
        <p className="text-xs text-mute mt-3">
          Preview only — submissions are not stored or sent yet.
        </p>
      </div>
    </form>
  );
}

function Legend({ children }: { children: React.ReactNode }) {
  return (
    <legend className="font-display text-2xl text-ink">{children}</legend>
  );
}

function FieldsetDivider() {
  return <div className="h-px bg-rule" role="presentation" />;
}

function Label({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-semibold uppercase tracking-[0.12em] text-mute mb-2"
    >
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full border border-rule bg-paper px-4 py-3 text-ink placeholder:text-mute focus:border-brass focus:outline-none rounded-sm"
    />
  );
}

function RoleChoice({
  value,
  current,
  onChange,
  label,
}: {
  value: "athlete" | "parent";
  current: "athlete" | "parent";
  onChange: (v: "athlete" | "parent") => void;
  label: string;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      aria-pressed={active}
      className={`px-4 py-3 text-sm border rounded-sm transition-colors text-left ${
        active
          ? "border-brass bg-brass/15 text-ink"
          : "border-rule bg-paper text-ink/80 hover:border-brass/60 hover:bg-brass/5"
      }`}
    >
      {label}
    </button>
  );
}

function SelectedSessionsList({
  sessions,
  onRemove,
}: {
  sessions: SessionSelection[];
  onRemove: (s: SessionSelection) => void;
}) {
  if (sessions.length === 0) {
    return (
      <p className="text-mute italic text-sm mt-4">No sessions selected yet.</p>
    );
  }
  return (
    <div className="mt-4">
      <div className="text-brass text-[10px] font-semibold uppercase tracking-[0.16em] mb-3">
        Selected sessions ({sessions.length})
      </div>
      <ul className="space-y-2">
        {sessions.map((s) => (
          <li
            key={`${s.date}-${s.weapon}`}
            className="flex items-center justify-between border-b border-rule pb-2"
          >
            <span className="text-ink">{formatSessionLong(s)}</span>
            <button
              type="button"
              onClick={() => onRemove(s)}
              className="text-xs font-semibold uppercase tracking-[0.08em] text-mute hover:text-purple-700 underline-draw"
              aria-label={`Remove ${formatSessionLong(s)}`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

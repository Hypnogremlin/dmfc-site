"use client";

import { useState, useTransition } from "react";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { claimSlot, type ClaimSelection } from "@/app/member/volunteer/actions";
import { shouldShowPicker, type Candidate } from "@/lib/volunteer/candidates";

function candidateKey(c: Candidate): string {
  if (c.kind === "profile") return `profile:${c.profileId}`;
  if (c.kind === "phantom") return `phantom:${c.seededFrom}`;
  return "other";
}

// Bare names are ambiguous in exactly the household this feature exists for:
// "Holland Reyes" and "Zane Reyes" tell a parent nothing about which one the
// radio is pointing at. Mirrors the disambiguation already rendered on
// /member/staff/roles — relationship lowercased in parens, "(minor)" for a
// minor — so one vocabulary describes these people everywhere.
function candidateQualifier(c: Candidate): string | null {
  if (c.kind === "other") return null;
  if (c.kind === "phantom") return c.relationship ? c.relationship.toLowerCase() : "guardian";
  if (c.isGuardian) return c.relationship ? c.relationship.toLowerCase() : "guardian";
  return c.isMinor ? "minor" : null;
}

function candidateLabel(c: Candidate): string {
  if (c.kind === "other") return "Someone else…";
  const qualifier = candidateQualifier(c);
  return qualifier ? `${c.name} (${qualifier})` : c.name;
}

function selectionFor(c: Candidate, otherName: string): ClaimSelection | null {
  if (c.kind === "profile") return { kind: "profile", profileId: c.profileId };
  if (c.kind === "phantom") return { kind: "phantom", seededFrom: c.seededFrom };
  const trimmed = otherName.trim();
  return trimmed ? { kind: "other", name: trimmed } : null;
}

// Candidates are pre-resolved server-side by candidatesFor() (see
// src/lib/volunteer/candidates.ts) and passed in as a prop — this component
// does no Supabase reads of its own, only the claimSlot write. Renders the
// radio group only when there's more than one real person to choose from
// (VOLUNTEERS.md: "a radio group with one option is noise") — a
// single-candidate account just gets a plain "Sign up" button that silently
// claims for that one person.
export function AttendeePicker({
  slotId,
  candidates,
  adultsOnly,
  onClaimed,
}: {
  slotId: string;
  candidates: Candidate[];
  adultsOnly: boolean;
  onClaimed: () => void;
}) {
  const eligible = adultsOnly ? candidates.filter((c) => c.kind === "other" || !c.isMinor) : candidates;
  const showPicker = shouldShowPicker(eligible);

  // Derived at render time rather than kept in sync via useEffect. The
  // parent (SlotCard) calls router.refresh() after a successful claim, which
  // re-renders this component with a new `candidates` prop but does NOT
  // remount it — a plain useState seed would keep pointing at whichever
  // candidate was selected before the refresh, even after that candidate is
  // filtered out of `eligible` for having just signed up. That left
  // handleSubmit's `if (!selectedCandidate) return;` silently doing nothing
  // on a second signup attempt for the same slot (e.g. Dad signs up, then
  // Mom tries to sign up for the same multi-capacity slot). Deriving here
  // means a stale key falls back to the first eligible candidate instead.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const activeKey =
    selectedKey && eligible.some((c) => candidateKey(c) === selectedKey)
      ? selectedKey
      : eligible.length > 0
        ? candidateKey(eligible[0])
        : null;

  const [otherName, setOtherName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (eligible.length === 0) {
    return <p className="text-sm text-mute">No eligible volunteers on this account for this role.</p>;
  }

  const selectedCandidate = eligible.find((c) => candidateKey(c) === activeKey) ?? null;

  function handleSubmit() {
    if (!selectedCandidate) {
      setError("Choose who's volunteering.");
      return;
    }
    const selection = selectionFor(selectedCandidate, otherName);
    if (!selection) {
      setError("Enter a name.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await claimSlot(slotId, selection);
      if (result.ok) {
        setOtherName("");
        setError(null);
        onClaimed();
      } else {
        setError(result.error ?? "Could not sign up for this slot.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {showPicker && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold text-ink mb-1">Who&rsquo;s volunteering?</legend>
          {eligible.map((c) => {
            const key = candidateKey(c);
            const label = candidateLabel(c);
            return (
              <label key={key} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  name={`attendee-${slotId}`}
                  checked={activeKey === key}
                  onChange={() => setSelectedKey(key)}
                />
                {label}
              </label>
            );
          })}
        </fieldset>
      )}

      {/* With one real candidate the radio group is suppressed (a one-option
          radio is noise) — but the name must not vanish with it. Before this
          line existed the button read a bare "Sign up" and the volunteer only
          learned who had been signed up after the page refreshed, which is
          worst in precisely the case this feature targets: a single-minor
          household on an adults-only slot, where the sole eligible candidate
          is the guardian and nothing on screen said so. */}
      {!showPicker && selectedCandidate && selectedCandidate.kind !== "other" && (
        <p className="text-sm text-mute">
          Signing up{" "}
          <span className="text-ink font-semibold">{candidateLabel(selectedCandidate)}</span>.
        </p>
      )}

      {selectedCandidate?.kind === "other" && (
        <TextField
          id={`attendee-name-${slotId}`}
          label="Name"
          value={otherName}
          onChange={setOtherName}
          required
        />
      )}

      {error && (
        <p className="text-sm text-red-700" role="alert" aria-live="polite">
          {error}
        </p>
      )}

      <Button
        as="button"
        type="button"
        variant="primary"
        arrow="none"
        disabled={isPending}
        onClick={handleSubmit}
      >
        {isPending ? "Signing up…" : "Sign up"}
      </Button>
    </div>
  );
}

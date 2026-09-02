"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/ConfirmButton";
import { AttendeePicker } from "./AttendeePicker";
import { cancelSignup } from "@/app/member/volunteer/actions";
import { formatClubTimeRange } from "@/lib/volunteer/datetime";
import type { VolunteerSlot } from "@/lib/volunteer/types";
import type { Candidate } from "@/lib/volunteer/candidates";

// One signup per attendee, so an account can hold more than one live signup
// on the same slot (Mom and Dad both work the check-in table) — mySignups is
// therefore a list, not a single id. The picker stays available below the
// list as long as the slot has an open spot, so a second household member
// can claim it too.
export function SlotCard({
  slot,
  filled,
  candidates,
  mySignups,
}: {
  slot: VolunteerSlot;
  filled: number;
  candidates: Candidate[];
  mySignups: { id: string; label: string; profileId: string | null }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelError, setCancelError] = useState<string | null>(null);
  const full = filled >= slot.capacity;
  const timeRange = formatClubTimeRange(slot.start_at, slot.ends_at);

  // Someone already signed up for this slot shouldn't be offered again in
  // the picker — attempting it would just bounce off the DB's unique index.
  const alreadySignedProfileIds = new Set(
    mySignups.map((s) => s.profileId).filter((id): id is string => id !== null)
  );
  const availableCandidates = candidates.filter(
    (c) => c.kind !== "profile" || !alreadySignedProfileIds.has(c.profileId)
  );

  function handleCancel(signupId: string) {
    startTransition(async () => {
      const result = await cancelSignup(signupId);
      if (result.ok) {
        setCancelError(null);
        router.refresh();
      } else {
        setCancelError(result.error ?? "Could not cancel this signup.");
      }
    });
  }

  // Pips read fine up to a normal roster size; past that they'd just be
  // visual noise, so large-capacity slots fall back to the plain count.
  const showPips = slot.capacity > 0 && slot.capacity <= 12;
  // Dim only when the slot is full AND the viewer has no stake in it —
  // a filled slot you're personally signed up for should still read clearly.
  const dimmed = full && mySignups.length === 0;

  return (
    <div
      className={`border border-brass/25 rounded-[4px] p-6 flex flex-col gap-4 transition-opacity ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-semibold text-ink">{slot.role_name}</p>
          {timeRange && <p className="text-sm text-mute tabular mt-0.5">{timeRange}</p>}
          {slot.notes && <p className="text-sm text-mute mt-1">{slot.notes}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {slot.adults_only && (
            <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] rounded-[2px] border border-mute/40 text-mute">
              Adults only
            </span>
          )}
          {showPips ? (
            <div className="flex items-center gap-2">
              <div aria-hidden="true" className="flex items-center gap-1">
                {Array.from({ length: slot.capacity }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-3.5 w-3.5 rounded-full border-[1.5px] border-brass ${
                      i < filled ? "bg-brass" : "bg-transparent"
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-mute tabular">
                {full ? "Filled" : `${filled} of ${slot.capacity} filled`}
              </span>
            </div>
          ) : (
            <span className="text-sm text-mute tabular">
              {filled} / {slot.capacity} filled
            </span>
          )}
        </div>
      </div>

      {mySignups.length > 0 && (
        <ul className="flex flex-col gap-2">
          {mySignups.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3">
              <p className="text-sm text-brass font-semibold">{s.label} is signed up.</p>
              <ConfirmButton
                label="Cancel"
                confirmLabel="Yes, cancel"
                confirmText="This can't be undone — you'll need to sign up again to reclaim the spot."
                onConfirm={() => handleCancel(s.id)}
                disabled={isPending}
              />
            </li>
          ))}
        </ul>
      )}

      {cancelError && (
        <p className="text-sm text-red-700" role="alert" aria-live="polite">
          {cancelError}
        </p>
      )}

      {full ? (
        mySignups.length === 0 && <p className="text-sm text-mute">This role is filled.</p>
      ) : (
        <AttendeePicker
          slotId={slot.id}
          candidates={availableCandidates}
          adultsOnly={slot.adults_only}
          onClaimed={() => router.refresh()}
        />
      )}
    </div>
  );
}

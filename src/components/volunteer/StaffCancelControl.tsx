"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { cancelSignupAsStaff, cancelSlotSignups } from "@/app/member/staff/actions";
import { SLOT_CANCEL_ACTION_LABEL } from "@/lib/volunteer/cancellations";

// Staff-side cancellation control for the event roster.
//
// Deliberately NOT built on <ConfirmButton>. That component's two steps are
// "click" then "confirm", which is right for Publish and Delete where there is
// nothing to type. Here a reason is mandatory — it is the only notice the
// volunteer will ever receive, because nothing emails them — so the flow is
// three states rather than two:
//
//   idle    → the plain trigger, so a stray click reveals a form and no more.
//   reason  → the required text, with the "no email is sent" warning next to
//             the field where it is being written, not buried in a heading.
//   confirm → the explicit second step, restating who is being removed and
//             the reason as typed. Nothing is submitted before this.
//
// The confirm step is not decoration: this takes away a shift someone
// committed to, in a system that will not tell them it happened except on a
// page they may not open. Two steps is the project's standing bar for anything
// hard to reverse — and this is hard to reverse in the way that matters, since
// re-adding the row would not un-send the "cancelled" notice they may already
// have read, and the spot may be gone to someone else by then.
//
// print:hidden throughout — the roster page is designed to be printed as a
// sign-in sheet and these controls are noise on paper.

type Target =
  | { kind: "signup"; signupId: string; who: string }
  | { kind: "slot"; slotId: string; roleName: string; count: number };

const NO_EMAIL_NOTICE =
  "No email is sent. Message them yourself — this reason only appears on their volunteer dashboard.";

export function StaffCancelControl({ target }: { target: Target }) {
  const router = useRouter();
  const [stage, setStage] = useState<"idle" | "reason" | "confirm">("idle");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const trimmed = reason.trim();

  // Shared with the two staff error messages that tell a coach to press this
  // exact control by name — see SLOT_CANCEL_ACTION_LABEL.
  const triggerLabel = target.kind === "signup" ? "Cancel" : SLOT_CANCEL_ACTION_LABEL;
  const subject =
    target.kind === "signup"
      ? `${target.who}'s spot`
      : `${target.count} ${target.count === 1 ? "volunteer" : "volunteers"} on "${target.roleName}"`;

  function reset() {
    setStage("idle");
    setReason("");
    setError(null);
  }

  function submit() {
    startTransition(async () => {
      const result =
        target.kind === "signup"
          ? await cancelSignupAsStaff(target.signupId, trimmed)
          : await cancelSlotSignups(target.slotId, trimmed);

      if (result.ok) {
        reset();
        // The roster is server-rendered from event_roster(), which returns
        // live signups only, so a refresh is what makes the cancelled row
        // disappear. Nothing here mutates local state to fake that.
        router.refresh();
      } else {
        setError(result.error ?? "Could not cancel.");
      }
    });
  }

  if (stage === "idle") {
    return (
      <button
        type="button"
        onClick={() => setStage("reason")}
        className="text-sm text-red-700 hover:text-red-900 underline transition-colors print:hidden"
      >
        {triggerLabel}
      </button>
    );
  }

  return (
    <div className="mt-3 border border-red-200 bg-red-50/60 rounded-[3px] p-4 print:hidden">
      {stage === "reason" ? (
        <>
          <label
            htmlFor={`cancel-reason-${target.kind === "signup" ? target.signupId : target.slotId}`}
            className="block text-sm font-semibold text-ink"
          >
            Why is {subject} being cancelled?
          </label>
          <p className="text-xs text-mute mt-1 leading-relaxed">{NO_EMAIL_NOTICE}</p>
          <textarea
            id={`cancel-reason-${target.kind === "signup" ? target.signupId : target.slotId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            required
            className="mt-2 w-full text-sm border border-brass/40 focus:border-brass rounded-[2px] px-3 py-2 bg-paper outline-none"
            placeholder="e.g. Tournament cancelled — no volunteers needed."
          />
          <div className="flex items-center gap-3 flex-wrap mt-3">
            <Button
              as="button"
              type="button"
              variant="secondary"
              arrow="none"
              disabled={!trimmed}
              onClick={() => {
                setError(null);
                setStage("confirm");
              }}
            >
              Continue
            </Button>
            <button
              type="button"
              onClick={reset}
              className="text-sm text-mute hover:text-ink underline transition-colors"
            >
              Never mind
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-ink">Cancel {subject}?</p>
          <p className="text-sm text-mute mt-1 leading-relaxed">
            They will see &ldquo;Cancelled by DMFC&rdquo; with your reason:{" "}
            <span className="text-ink">&ldquo;{trimmed}&rdquo;</span>
          </p>
          <p className="text-xs text-mute mt-1 leading-relaxed">{NO_EMAIL_NOTICE}</p>
          <div className="flex items-center gap-3 flex-wrap mt-3">
            <Button
              as="button"
              type="button"
              variant="primary"
              arrow="none"
              disabled={isPending}
              onClick={submit}
            >
              {isPending ? "Cancelling…" : "Yes, cancel"}
            </Button>
            <button
              type="button"
              onClick={() => setStage("reason")}
              className="text-sm text-mute hover:text-ink underline transition-colors"
            >
              Back
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="text-sm text-red-700 mt-3" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAccountRole } from "./actions";

// Mirrors GRANTABLE_ROLES in ./actions.ts. Kept as its own list rather than
// imported: that file is "use server", so everything it exports must be an
// async function — a re-exported const would be a build error. The server copy
// is the enforced one; this is only what the UI offers.
const ROLE_OPTIONS = [
  { value: "member", label: "Member" },
  { value: "coach", label: "Coach" },
  { value: "board", label: "Board" },
] as const;

type Props = {
  accountId: string;
  currentRole: string | null;
  /** True for the signed-in admin's own row — the control is replaced, not disabled. */
  isSelf: boolean;
};

export function RoleControl({ accountId, currentRole, isSelf }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (isSelf) {
    return (
      <p className="text-sm text-mute flex-shrink-0">
        Your account —{" "}
        <span className="font-semibold text-ink uppercase tracking-[0.08em]">
          {currentRole ?? "unknown"}
        </span>
      </p>
    );
  }

  // An account with no settings row can't be granted anything meaningfully —
  // surface it rather than rendering a control that will fail.
  if (currentRole === null) {
    return (
      <p className="text-sm text-red-700 flex-shrink-0">
        No settings row — repair in SQL
      </p>
    );
  }

  function choose(next: string) {
    if (next === currentRole || isPending) return;
    setError(null);
    setStatus(null);
    startTransition(async () => {
      const result = await setAccountRole(accountId, next);
      if (result.ok) {
        // Sighted users see the highlight move. Without this, a screen-reader
        // user gets no confirmation at all that the grant landed.
        setStatus(`Role changed to ${next}.`);
        router.refresh();
      } else {
        setError(result.error ?? "Could not change that role.");
      }
    });
  }

  return (
    <div className="flex-shrink-0">
      {/* Toggle buttons with aria-pressed, deliberately NOT role="radiogroup".
          Declaring a radiogroup is a promise to assistive tech that Arrow keys
          move between the options (the APG roving-tabindex pattern) — a promise
          this control did not keep, so a screen-reader user was told to press
          arrows and nothing happened. Three plain buttons, each stating whether
          it is the current role, describe what this actually is: Tab reaches
          each one and Enter activates it, which works today. */}
      <div
        role="group"
        aria-label="Account role"
        className={`inline-flex border border-rule rounded-[2px] overflow-hidden ${
          isPending ? "opacity-60" : ""
        }`}
      >
        {ROLE_OPTIONS.map((option) => {
          const active = option.value === currentRole;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              disabled={isPending}
              onClick={() => choose(option.value)}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition-colors disabled:cursor-not-allowed ${
                active
                  ? "bg-purple-950 text-bone"
                  : "bg-transparent text-mute hover:text-ink hover:bg-rule/30"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Always rendered, so assistive tech is already watching it when the
          text appears. A region mounted at the same moment its content changes
          is frequently not announced. */}
      <p className="sr-only" role="status" aria-live="polite">
        {status ?? ""}
      </p>

      {error && (
        <p
          className="text-sm text-red-700 mt-2 max-w-xs"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

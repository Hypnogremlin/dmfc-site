"use client";

import { useState } from "react";
import { Button } from "@/components/Button";

// Two-step inline confirm for one-way actions (publish, delete). No modal/
// dialog library exists in this codebase and no window.confirm() precedent
// either — clicking the button reveals a second, explicit confirm step
// inline rather than popping a browser dialog. Reused for both Publish and
// Delete on the staff event form rather than building the toggle twice.
export function ConfirmButton({
  label,
  confirmLabel,
  confirmText,
  onConfirm,
  variant = "secondary",
  disabled,
}: {
  label: string;
  confirmLabel: string;
  confirmText?: string;
  onConfirm: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        {confirmText && <p className="text-sm text-mute">{confirmText}</p>}
        <Button
          as="button"
          type="button"
          variant="primary"
          arrow="none"
          onClick={() => {
            setConfirming(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-sm text-mute hover:text-ink underline transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <Button
      as="button"
      type="button"
      variant={variant}
      arrow="none"
      disabled={disabled}
      onClick={() => setConfirming(true)}
    >
      {label}
    </Button>
  );
}

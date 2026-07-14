"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { Button } from "@/components/Button";

interface ConfirmSignInProps {
  tokenHash?: string;
  type?: string;
}

export function ConfirmSignIn({ tokenHash, type }: ConfirmSignInProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "verifying" | "error">("idle");

  const valid = Boolean(tokenHash) && type === "email";

  async function handleConfirm() {
    if (!tokenHash) return;
    setStatus("verifying");

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email",
    });

    if (error) {
      setStatus("error");
      return;
    }

    router.push("/member");
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-20 px-6">
      <div className="w-full max-w-md text-center">
        <div className="h-px bg-brass mb-8" />
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brass mb-4">
          Des Moines Fencing Club
        </p>

        {!valid || status === "error" ? (
          <>
            <h1 className="font-display text-[clamp(32px,5vw,48px)] leading-[1.05] text-ink mb-6">
              Link <span className="italic">expired</span>
            </h1>
            <p className="text-sm text-mute leading-relaxed mb-8">
              {!valid
                ? "This sign-in link is missing or malformed."
                : "That link has already been used or has expired."}{" "}
              Please request a new one.
            </p>
            <Button as="link" href="/login" variant="primary" className="justify-center">
              Back to login
            </Button>
          </>
        ) : (
          <>
            <h1 className="font-display text-[clamp(32px,5vw,48px)] leading-[1.05] text-ink mb-6">
              Confirm your <span className="italic">sign-in</span>
            </h1>
            <p className="text-sm text-mute leading-relaxed mb-8">
              For your security, we need a real click to finish signing you in —
              some email providers automatically open links to scan them, which
              can burn a one-time sign-in link before you ever see it.
            </p>
            <Button
              as="button"
              variant="primary"
              onClick={handleConfirm}
              disabled={status === "verifying"}
              className="w-full justify-center"
            >
              {status === "verifying" ? "Signing in…" : "Confirm Sign In"}
            </Button>
          </>
        )}

        <div className="h-px bg-rule mt-10" />
      </div>
    </div>
  );
}

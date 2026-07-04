"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { Button } from "@/components/Button";

interface LoginFormProps {
  next?: string;
  error?: string;
}

export function LoginForm({ next, error }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const supabase = createBrowserSupabaseClient();
    // Encode `next` — it's embedded directly in a query string, and an
    // unencoded value (e.g. containing "&" or "#") could smuggle in extra
    // query params or get misparsed by the callback route.
    const encodedNext = encodeURIComponent(next ?? "/member");
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?next=${encodedNext}`
        : `/auth/callback?next=${encodedNext}`;

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (otpError) {
      setSubmitError(otpError.message);
      setSubmitting(false);
      return;
    }

    setSent(true);
    setSubmitting(false);
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-20 px-6">
      <div className="w-full max-w-md">
        {/* Brass accent bar */}
        <div className="h-px bg-brass mb-8" />

        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brass mb-4">
          Des Moines Fencing Club
        </p>

        <h1 className="font-display text-[clamp(36px,6vw,56px)] leading-[1.05] text-ink mb-8">
          Member
          <br />
          <span className="italic">Login</span>
        </h1>

        {/* Expired-link error banner */}
        {error === "auth" && !sent && (
          <div className="mb-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 rounded-[3px]">
            That link has expired or is invalid. Please request a new one.
          </div>
        )}

        {sent ? (
          <div className="border border-brass/40 bg-brass/5 px-6 py-5 rounded-[3px]">
            <p className="font-semibold text-ink">Check your email</p>
            <p className="mt-1 text-sm text-mute leading-relaxed">
              We sent a magic link to <span className="text-ink font-medium">{email}</span>.
              Click it to sign in — no password needed.
            </p>
            <button
              type="button"
              onClick={() => { setSent(false); setEmail(""); }}
              className="mt-4 text-xs text-mute underline hover:text-ink transition-colors"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-[0.12em] text-ink"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="border border-rule bg-paper px-4 py-3 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-brass transition-colors rounded-[3px] w-full"
              />
            </div>

            {submitError && (
              <p className="text-xs text-red-600" role="alert">
                {submitError}
              </p>
            )}

            <Button
              as="button"
              type="submit"
              variant="primary"
              disabled={submitting}
              className="w-full justify-center"
            >
              {submitting ? "Sending…" : "Send magic link"}
            </Button>

            <p className="text-xs text-mute leading-relaxed text-center">
              Enter the email address you used when you joined the club.
              We’ll send a one-time sign-in link — no password needed.
            </p>
          </form>
        )}

        <div className="h-px bg-rule mt-10" />
      </div>
    </div>
  );
}

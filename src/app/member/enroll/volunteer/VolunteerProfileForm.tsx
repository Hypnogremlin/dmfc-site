"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import type { VolunteerProfileData } from "@/lib/member-types";
import {
  validateVolunteerProfile,
  type VolunteerProfileErrors,
} from "@/lib/volunteer/profile-validation";
import { createVolunteerProfile } from "./actions";

export function VolunteerProfileForm({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [data, setData] = useState<VolunteerProfileData>({
    first_name: "",
    last_name: "",
    // Prefilled but editable — a board member may want club mail at a
    // different address than the one they happened to sign in with.
    contact_email: userEmail,
    contact_phone: "",
  });
  const [errors, setErrors] = useState<VolunteerProfileErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  function set<K extends keyof VolunteerProfileData>(
    key: K,
    value: VolunteerProfileData[K]
  ) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    setFormError(null);
    const found = validateVolunteerProfile(data);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    startTransition(async () => {
      const result = await createVolunteerProfile(data);
      if (result.ok) {
        router.push("/member");
        // The dashboard is a shared layout segment; without this the header
        // and member list can render from cache. Same fix as the magic-link
        // sign-in path (see commit 9493a68).
        router.refresh();
      } else {
        setFormError(result.error ?? "Could not create your profile.");
      }
    });
  }

  return (
    <div className="max-w-xl flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <TextField
          id="first_name"
          label="First name"
          value={data.first_name}
          onChange={(v) => set("first_name", v)}
          required
          error={errors.first_name}
        />
        <TextField
          id="last_name"
          label="Last name"
          value={data.last_name}
          onChange={(v) => set("last_name", v)}
          required
          error={errors.last_name}
        />
      </div>

      <TextField
        id="contact_email"
        label="Email"
        type="email"
        value={data.contact_email}
        onChange={(v) => set("contact_email", v)}
        required
        error={errors.contact_email}
        hint="Where the club will reach you about volunteering."
      />

      <TextField
        id="contact_phone"
        label="Phone"
        type="tel"
        value={data.contact_phone}
        onChange={(v) => set("contact_phone", v)}
        required
        error={errors.contact_phone}
        hint="Used on tournament mornings, when email is too slow."
      />

      {formError && (
        <p className="text-sm text-red-700" role="alert" aria-live="polite">
          {formError}
        </p>
      )}

      <div className="flex items-center gap-4 flex-wrap pt-6 border-t border-rule">
        <Button
          as="button"
          onClick={handleSubmit}
          disabled={isPending}
          arrow="none"
          variant="primary"
        >
          {isPending ? "Creating…" : "Create profile"}
        </Button>
        <a
          href="/member/enroll"
          className="text-sm text-mute hover:text-ink underline transition-colors"
        >
          I am enrolling a fencer instead
        </a>
      </div>
    </div>
  );
}

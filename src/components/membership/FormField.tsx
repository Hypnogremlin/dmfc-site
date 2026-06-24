import { ReactNode } from "react";

type Props = {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
};

export function FormField({ label, required, hint, error, children, htmlFor }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold uppercase tracking-[0.12em] text-ink"
      >
        {label}
        {required && (
          <span className="text-brass ml-0.5" aria-label="required">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-mute mt-0.5">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-600 mt-0.5" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}

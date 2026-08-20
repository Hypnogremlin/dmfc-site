import { FormField } from "@/components/membership/FormField";

// Extracted from src/components/membership/MembershipForm.tsx, which had its
// own file-local copy despite the component being generic (it just wraps
// FormField around a plain <input>). M2's staff event/slot forms are the
// third form in the app needing this exact pattern — worth the one-time
// extraction rather than a third copy-paste. MembershipForm now imports this
// instead of redefining it; ObservationForm's local `Input` uses a different
// visual treatment (no FormField wrapper) and was left alone.

const inputBase =
  "w-full bg-white border border-rule px-3 py-2.5 text-[15px] text-ink " +
  "placeholder:text-mute/60 focus:outline-none focus:ring-0 " +
  "focus:border-brass transition-colors duration-150";

const inputError = "border-red-500";

function cx(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

function inputCls(err?: string) {
  return cx(inputBase, !!err && inputError);
}

export function TextField({
  id,
  label,
  value,
  onChange,
  required,
  error,
  hint,
  type = "text",
  placeholder,
  readOnly,
}: {
  id: string;
  label: string;
  value: string;
  onChange?: (v: string) => void;
  required?: boolean;
  error?: string;
  hint?: string;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <FormField label={label} required={required} error={error} hint={hint} htmlFor={id}>
      <input
        id={id}
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        className={cx(inputCls(error), readOnly && "opacity-60 cursor-not-allowed")}
      />
    </FormField>
  );
}

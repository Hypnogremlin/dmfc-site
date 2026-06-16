"use client";

import { useState } from "react";
import {
  MembershipFormData,
  WeaponClass,
  SexAtBirth,
  ShirtSize,
  SignerType,
} from "@/lib/member-types";
import { Button } from "@/components/Button";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { FormField } from "./FormField";

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = {
  userEmail: string;
  onSubmit: (data: MembershipFormData) => Promise<{ ok: boolean; error?: string }>;
};

type Errors = Partial<Record<keyof MembershipFormData, string>>;

// ─── Constants ───────────────────────────────────────────────────────────────

const TOTAL_STEPS = 6;

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
  "VT","VA","WA","WV","WI","WY",
];

const WEAPON_OPTIONS: { value: WeaponClass; label: string }[] = [
  { value: "foil-youth", label: "Foil Youth (Mon 6:30p)" },
  { value: "foil-adult", label: "Foil Adult (Mon 8:00p)" },
  { value: "epee",       label: "Épée (Mon 6:30p)" },
  { value: "saber",      label: "Saber (Thu 6:30p)" },
];

const YOUTH_SHIRT_SIZES: ShirtSize[] = ["YXS", "YS", "YM", "YL", "YXL"];
const ADULT_SHIRT_SIZES: ShirtSize[] = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

const SEX_OPTIONS: { value: SexAtBirth; label: string }[] = [
  { value: "male",              label: "Male" },
  { value: "female",            label: "Female" },
  { value: "intersex",          label: "Intersex" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const SIGNER_OPTIONS: { value: SignerType; label: string }[] = [
  { value: "athlete",  label: "I am the athlete (18+)" },
  { value: "guardian", label: "I am a parent or guardian" },
];

const STEP_LABELS = [
  "Athlete Info",
  "Main Contact",
  "Emergency Contact 1",
  "Emergency Contact 2",
  "Medical",
  "Waivers",
];

// ─── Initial form state ───────────────────────────────────────────────────────

function initialFormData(userEmail: string): MembershipFormData {
  return {
    first_name: "",
    last_name: "",
    birthday: "",
    usa_citizen: true,
    sex_at_birth: "",
    gender_identity: "",
    weapon_classes: [],
    shirt_size: "",
    contact_email: userEmail,
    contact_phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip_code: "",
    ec1_last_name: "",
    ec1_first_name: "",
    ec1_relationship: "",
    ec1_email: "",
    ec1_phone: "",
    ec1_address_line1: "",
    ec1_address_line2: "",
    ec1_city: "",
    ec1_state: "",
    ec1_zip_code: "",
    ec2_last_name: "",
    ec2_first_name: "",
    ec2_relationship: "",
    ec2_email: "",
    ec2_email_2: "",
    ec2_phone: "",
    ec2_phone_2: "",
    ec2_address_line1: "",
    ec2_address_line2: "",
    ec2_city: "",
    ec2_state: "",
    ec2_zip_code: "",
    medical_conditions: "",
    preferred_medical_system: "",
    dmfc_rules_agreed: false,
    dmfc_rules_signature: "",
    dmfc_rules_signer_type: "",
    usa_fencing_agreed: false,
    usa_fencing_signature: "",
    usa_fencing_signer_type: "",
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateStep(step: number, data: MembershipFormData): Errors {
  const errs: Errors = {};

  if (step === 0) {
    if (!data.first_name.trim()) errs.first_name = "First name is required.";
    if (!data.last_name.trim())  errs.last_name  = "Last name is required.";
    if (!data.birthday)          errs.birthday   = "Birthday is required.";
    if (!data.sex_at_birth)      errs.sex_at_birth = "Please select an option.";
    if (data.weapon_classes.length === 0) errs.weapon_classes = "Select at least one class.";
  }

  if (step === 1) {
    if (!data.contact_email.trim()) errs.contact_email = "Email is required.";
    if (!data.contact_phone.trim()) errs.contact_phone = "Phone is required.";
    if (!data.address_line1.trim()) errs.address_line1 = "Address is required.";
    if (!data.city.trim())          errs.city          = "City is required.";
    if (!data.state)                errs.state         = "State is required.";
    if (!data.zip_code.trim())      errs.zip_code      = "Zip code is required.";
  }

  if (step === 2) {
    if (!data.ec1_last_name.trim())   errs.ec1_last_name   = "Last name is required.";
    if (!data.ec1_first_name.trim())  errs.ec1_first_name  = "First name is required.";
    if (!data.ec1_relationship.trim()) errs.ec1_relationship = "Relationship is required.";
    if (!data.ec1_phone.trim())       errs.ec1_phone       = "Phone is required.";
  }

  if (step === 5) {
    if (!data.dmfc_rules_signer_type) errs.dmfc_rules_signer_type = "Please select a signer type.";
    if (!data.dmfc_rules_signature.trim()) errs.dmfc_rules_signature = "Signature is required.";
    if (!data.dmfc_rules_agreed) errs.dmfc_rules_agreed = "You must agree to the DMFC Membership Agreement.";
    if (!data.usa_fencing_signer_type) errs.usa_fencing_signer_type = "Please select a signer type.";
    if (!data.usa_fencing_signature.trim()) errs.usa_fencing_signature = "Signature is required.";
    if (!data.usa_fencing_agreed) errs.usa_fencing_agreed = "You must agree to the USA Fencing Membership Agreement.";
  }

  return errs;
}

// ─── Shared input styles ──────────────────────────────────────────────────────

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

// ─── Reusable sub-components ─────────────────────────────────────────────────

function TextField({
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

function SelectField({
  id,
  label,
  value,
  onChange,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <FormField label={label} required={required} error={error} htmlFor={id}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(inputCls(error), "cursor-pointer")}
      >
        {children}
      </select>
    </FormField>
  );
}

function TextareaField({
  id,
  label,
  value,
  onChange,
  required,
  error,
  hint,
  placeholder,
  rows = 4,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <FormField label={label} required={required} error={error} hint={hint} htmlFor={id}>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={cx(inputCls(error), "resize-y")}
      />
    </FormField>
  );
}

function StateSelect({
  id,
  label,
  value,
  onChange,
  required,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string;
}) {
  return (
    <SelectField id={id} label={label} value={value} onChange={onChange} required={required} error={error}>
      <option value="">— Select State —</option>
      {US_STATES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </SelectField>
  );
}

function AddressBlock({
  prefix,
  data,
  onChange,
  errors,
  required,
}: {
  prefix: string;
  data: {
    address_line1: string;
    address_line2: string;
    city: string;
    state: string;
    zip_code: string;
  };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string | undefined>;
  required?: boolean;
}) {
  return (
    <>
      <TextField
        id={`${prefix}address_line1`}
        label="Address Line 1"
        value={data.address_line1}
        onChange={(v) => onChange(`${prefix}address_line1`, v)}
        required={required}
        error={errors[`${prefix}address_line1`]}
        placeholder="123 Main St"
      />
      <TextField
        id={`${prefix}address_line2`}
        label="Address Line 2 / Apt, Unit #"
        value={data.address_line2}
        onChange={(v) => onChange(`${prefix}address_line2`, v)}
        placeholder="Apt 4B"
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="col-span-2 md:col-span-1">
          <TextField
            id={`${prefix}city`}
            label="City"
            value={data.city}
            onChange={(v) => onChange(`${prefix}city`, v)}
            required={required}
            error={errors[`${prefix}city`]}
          />
        </div>
        <StateSelect
          id={`${prefix}state`}
          label="State"
          value={data.state}
          onChange={(v) => onChange(`${prefix}state`, v)}
          required={required}
          error={errors[`${prefix}state`]}
        />
        <TextField
          id={`${prefix}zip_code`}
          label="Zip Code"
          value={data.zip_code}
          onChange={(v) => onChange(`${prefix}zip_code`, v)}
          required={required}
          error={errors[`${prefix}zip_code`]}
        />
      </div>
    </>
  );
}

// ─── Waiver Block ─────────────────────────────────────────────────────────────

function WaiverBlock({
  id,
  header,
  description,
  links,
  signerType,
  onSignerType,
  signerTypeError,
  signature,
  onSignature,
  signatureError,
  agreed,
  onAgreed,
  agreedError,
}: {
  id: string;
  header: string;
  description: string;
  links?: { label: string; href: string }[];
  signerType: SignerType | "";
  onSignerType: (v: SignerType) => void;
  signerTypeError?: string;
  signature: string;
  onSignature: (v: string) => void;
  signatureError?: string;
  agreed: boolean;
  onAgreed: (v: boolean) => void;
  agreedError?: string;
}) {
  return (
    <div className="border border-brass/30 p-6 flex flex-col gap-5">
      <div>
        <h3 className="font-display text-bone text-xl mb-2">{header}</h3>
        <p className="text-bone/80 text-[15px] leading-relaxed">{description}</p>
        {links && links.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brass text-sm underline-draw underline-offset-2 underline"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <StripRule />

      {/* Signer type */}
      <FormField label="I am signing as" required error={signerTypeError}>
        <div className="flex flex-col gap-2 mt-1">
          {SIGNER_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <input
                type="radio"
                name={`${id}_signer_type`}
                value={opt.value}
                checked={signerType === opt.value}
                onChange={() => onSignerType(opt.value)}
                className="w-4 h-4 accent-brass"
              />
              <span className="text-bone/90 text-[15px] group-hover:text-bone transition-colors">
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </FormField>

      {/* Typed signature */}
      <FormField
        label="Signature"
        required
        error={signatureError}
        hint="Type your full legal name"
        htmlFor={`${id}_signature`}
      >
        <input
          id={`${id}_signature`}
          type="text"
          value={signature}
          onChange={(e) => onSignature(e.target.value)}
          placeholder="Your full name"
          className={cx(
            "w-full bg-purple-900 border px-3 py-2.5 text-[15px] text-bone/90 placeholder:text-bone/30 " +
            "focus:outline-none focus:ring-0 transition-colors duration-150 italic",
            signatureError ? "border-red-400" : "border-brass/40 focus:border-brass"
          )}
        />
      </FormField>

      {/* Agreement checkbox */}
      <FormField label="" error={agreedError}>
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => onAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-brass flex-shrink-0"
          />
          <span className="text-bone/80 text-[15px] leading-relaxed group-hover:text-bone transition-colors">
            I have read and agree to the {header}.
          </span>
        </label>
      </FormField>
    </div>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function Step0AthleteInfo({
  data,
  onChange,
  errors,
}: {
  data: MembershipFormData;
  onChange: <K extends keyof MembershipFormData>(field: K, value: MembershipFormData[K]) => void;
  errors: Errors;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <TextField
          id="first_name"
          label="First Name"
          value={data.first_name}
          onChange={(v) => onChange("first_name", v)}
          required
          error={errors.first_name}
        />
        <TextField
          id="last_name"
          label="Last Name"
          value={data.last_name}
          onChange={(v) => onChange("last_name", v)}
          required
          error={errors.last_name}
        />
      </div>

      <TextField
        id="birthday"
        label="Date of Birth"
        type="date"
        value={data.birthday}
        onChange={(v) => onChange("birthday", v)}
        required
        error={errors.birthday}
      />

      {/* USA Citizen */}
      <FormField label="US Citizen" required>
        <div className="flex gap-6 mt-1">
          {([true, false] as const).map((val) => (
            <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="usa_citizen"
                checked={data.usa_citizen === val}
                onChange={() => onChange("usa_citizen", val)}
                className="w-4 h-4 accent-brass"
              />
              <span className="text-[15px] text-ink">{val ? "Yes" : "No"}</span>
            </label>
          ))}
        </div>
      </FormField>

      {/* Sex at birth */}
      <SelectField
        id="sex_at_birth"
        label="Sex at Birth"
        value={data.sex_at_birth}
        onChange={(v) => onChange("sex_at_birth", v as SexAtBirth)}
        required
        error={errors.sex_at_birth}
      >
        <option value="">— Select —</option>
        {SEX_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </SelectField>

      {/* Gender identity */}
      <TextField
        id="gender_identity"
        label="Gender Identity (optional)"
        value={data.gender_identity}
        onChange={(v) => onChange("gender_identity", v)}
        placeholder="e.g. Non-binary, Woman, Man"
      />

      {/* Weapon classes */}
      <FormField label="Weapon Classes to Attend" required error={errors.weapon_classes}>
        <div className="flex flex-col gap-2 mt-1">
          {WEAPON_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                value={opt.value}
                checked={data.weapon_classes.includes(opt.value)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...data.weapon_classes, opt.value]
                    : data.weapon_classes.filter((w) => w !== opt.value);
                  onChange("weapon_classes", next);
                }}
                className="w-4 h-4 accent-brass"
              />
              <span className="text-[15px] text-ink group-hover:text-purple-700 transition-colors">
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </FormField>

      {/* Shirt size */}
      <SelectField
        id="shirt_size"
        label="Shirt Size"
        value={data.shirt_size}
        onChange={(v) => onChange("shirt_size", v as ShirtSize)}
        error={errors.shirt_size}
      >
        <option value="">— Select Size —</option>
        <optgroup label="Youth Sizes">
          {YOUTH_SHIRT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </optgroup>
        <optgroup label="Adult Sizes">
          {ADULT_SHIRT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </optgroup>
      </SelectField>
    </div>
  );
}

function Step1MainContact({
  data,
  onChange,
  errors,
}: {
  data: MembershipFormData;
  onChange: <K extends keyof MembershipFormData>(field: K, value: MembershipFormData[K]) => void;
  errors: Errors;
}) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[15px] text-mute leading-relaxed border-l-2 border-brass pl-3">
        Who should we contact about membership matters? If the athlete is an
        adult, this is usually the athlete themselves.
      </p>

      <TextField
        id="contact_email"
        label="Email"
        type="email"
        value={data.contact_email}
        required
        error={errors.contact_email}
        hint="This is your login email"
        readOnly
      />

      <TextField
        id="contact_phone"
        label="Phone"
        type="tel"
        value={data.contact_phone}
        onChange={(v) => onChange("contact_phone", v)}
        required
        error={errors.contact_phone}
        placeholder="(515) 555-0100"
      />

      <AddressBlock
        prefix=""
        data={{
          address_line1: data.address_line1,
          address_line2: data.address_line2,
          city: data.city,
          state: data.state,
          zip_code: data.zip_code,
        }}
        onChange={(field, value) => onChange(field as keyof MembershipFormData, value)}
        errors={errors as Record<string, string | undefined>}
        required
      />
    </div>
  );
}

function Step2EC1({
  data,
  onChange,
  errors,
}: {
  data: MembershipFormData;
  onChange: <K extends keyof MembershipFormData>(field: K, value: MembershipFormData[K]) => void;
  errors: Errors;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <TextField
          id="ec1_last_name"
          label="Last Name"
          value={data.ec1_last_name}
          onChange={(v) => onChange("ec1_last_name", v)}
          required
          error={errors.ec1_last_name}
        />
        <TextField
          id="ec1_first_name"
          label="First Name"
          value={data.ec1_first_name}
          onChange={(v) => onChange("ec1_first_name", v)}
          required
          error={errors.ec1_first_name}
        />
      </div>

      <TextField
        id="ec1_relationship"
        label="Relationship"
        value={data.ec1_relationship}
        onChange={(v) => onChange("ec1_relationship", v)}
        required
        error={errors.ec1_relationship}
        placeholder="e.g. Parent, Spouse, Friend"
      />

      <TextField
        id="ec1_email"
        label="Email (optional)"
        type="email"
        value={data.ec1_email}
        onChange={(v) => onChange("ec1_email", v)}
        placeholder="email@example.com"
      />

      <TextField
        id="ec1_phone"
        label="Phone"
        type="tel"
        value={data.ec1_phone}
        onChange={(v) => onChange("ec1_phone", v)}
        required
        error={errors.ec1_phone}
        placeholder="(515) 555-0100"
      />

      <AddressBlock
        prefix="ec1_"
        data={{
          address_line1: data.ec1_address_line1,
          address_line2: data.ec1_address_line2,
          city: data.ec1_city,
          state: data.ec1_state,
          zip_code: data.ec1_zip_code,
        }}
        onChange={(field, value) => onChange(field as keyof MembershipFormData, value)}
        errors={errors as Record<string, string | undefined>}
      />
    </div>
  );
}

function Step3EC2({
  data,
  onChange,
  errors,
}: {
  data: MembershipFormData;
  onChange: <K extends keyof MembershipFormData>(field: K, value: MembershipFormData[K]) => void;
  errors: Errors;
}) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[15px] text-mute leading-relaxed">
        All fields optional — fill in as much as you have.
      </p>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <TextField
          id="ec2_last_name"
          label="Last Name"
          value={data.ec2_last_name}
          onChange={(v) => onChange("ec2_last_name", v)}
        />
        <TextField
          id="ec2_first_name"
          label="First Name"
          value={data.ec2_first_name}
          onChange={(v) => onChange("ec2_first_name", v)}
        />
      </div>

      <TextField
        id="ec2_relationship"
        label="Relationship"
        value={data.ec2_relationship}
        onChange={(v) => onChange("ec2_relationship", v)}
        placeholder="e.g. Grandparent, Sibling"
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <TextField
          id="ec2_email"
          label="Email (optional)"
          type="email"
          value={data.ec2_email}
          onChange={(v) => onChange("ec2_email", v)}
        />
        <TextField
          id="ec2_email_2"
          label="Email 2 (optional)"
          type="email"
          value={data.ec2_email_2}
          onChange={(v) => onChange("ec2_email_2", v)}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <TextField
          id="ec2_phone"
          label="Phone (optional)"
          type="tel"
          value={data.ec2_phone}
          onChange={(v) => onChange("ec2_phone", v)}
        />
        <TextField
          id="ec2_phone_2"
          label="Phone 2 (optional)"
          type="tel"
          value={data.ec2_phone_2}
          onChange={(v) => onChange("ec2_phone_2", v)}
        />
      </div>

      <AddressBlock
        prefix="ec2_"
        data={{
          address_line1: data.ec2_address_line1,
          address_line2: data.ec2_address_line2,
          city: data.ec2_city,
          state: data.ec2_state,
          zip_code: data.ec2_zip_code,
        }}
        onChange={(field, value) => onChange(field as keyof MembershipFormData, value)}
        errors={errors as Record<string, string | undefined>}
      />
    </div>
  );
}

function Step4Medical({
  data,
  onChange,
}: {
  data: MembershipFormData;
  onChange: <K extends keyof MembershipFormData>(field: K, value: MembershipFormData[K]) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="bg-purple-50 border border-rule px-4 py-3 text-[14px] text-mute leading-relaxed">
        This information is kept confidential and is only accessible to those
        who would need to administer first aid.
      </div>

      <TextareaField
        id="medical_conditions"
        label="Medical Conditions / First-Aid Notes (optional)"
        value={data.medical_conditions}
        onChange={(v) => onChange("medical_conditions", v)}
        placeholder="e.g. severe peanut allergy, asthma, diabetes"
        rows={5}
      />

      <TextField
        id="preferred_medical_system"
        label="Preferred Medical System (optional)"
        value={data.preferred_medical_system}
        onChange={(v) => onChange("preferred_medical_system", v)}
        placeholder="e.g. UnityPoint, MercyOne"
      />
    </div>
  );
}

function Step5Waivers({
  data,
  onChange,
  errors,
}: {
  data: MembershipFormData;
  onChange: <K extends keyof MembershipFormData>(field: K, value: MembershipFormData[K]) => void;
  errors: Errors;
}) {
  return (
    <div className="flex flex-col gap-8">
      <WaiverBlock
        id="dmfc_rules"
        header="DMFC Membership Agreement"
        description="By signing below, you agree to abide by the current rules and policies of the Des Moines Fencing Club, including the member code of conduct and any updates communicated during the membership season."
        signerType={data.dmfc_rules_signer_type}
        onSignerType={(v) => onChange("dmfc_rules_signer_type", v)}
        signerTypeError={errors.dmfc_rules_signer_type}
        signature={data.dmfc_rules_signature}
        onSignature={(v) => onChange("dmfc_rules_signature", v)}
        signatureError={errors.dmfc_rules_signature}
        agreed={data.dmfc_rules_agreed}
        onAgreed={(v) => onChange("dmfc_rules_agreed", v)}
        agreedError={errors.dmfc_rules_agreed}
      />

      <WaiverBlock
        id="usa_fencing"
        header="USA Fencing Membership Agreement"
        description="DMFC membership requires a current USA Fencing membership. By signing below, you acknowledge that you have read and agree to the USA Fencing membership terms, including assumption of risk, anti-doping rules, and arbitration provisions."
        links={[
          {
            label: "Read the USA Fencing Rules & Compliance",
            href: "https://www.usafencing.org/rules-compliance",
          },
          {
            label: "Review the Minor Athlete Abuse Prevention Policy (MAAPP)",
            href: "https://www.usafencing.org/maapp",
          },
        ]}
        signerType={data.usa_fencing_signer_type}
        onSignerType={(v) => onChange("usa_fencing_signer_type", v)}
        signerTypeError={errors.usa_fencing_signer_type}
        signature={data.usa_fencing_signature}
        onSignature={(v) => onChange("usa_fencing_signature", v)}
        signatureError={errors.usa_fencing_signature}
        agreed={data.usa_fencing_agreed}
        onAgreed={(v) => onChange("usa_fencing_agreed", v)}
        agreedError={errors.usa_fencing_agreed}
      />
    </div>
  );
}

// ─── Progress Indicator ────────────────────────────────────────────────────────

function ProgressIndicator({ step }: { step: number }) {
  const pct = Math.round(((step + 1) / TOTAL_STEPS) * 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Eyebrow>
          Step {step + 1} of {TOTAL_STEPS}
        </Eyebrow>
        <span className="text-xs font-semibold text-mute uppercase tracking-[0.08em]">
          {STEP_LABELS[step]}
        </span>
      </div>
      <div
        className="h-1 w-full rounded-full bg-rule overflow-hidden"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-label={`Step ${step + 1} of ${TOTAL_STEPS}: ${STEP_LABELS[step]}`}
      >
        <div
          className="h-full bg-brass transition-all duration-300 ease-out rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MembershipForm({ userEmail, onSubmit }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<MembershipFormData>(() =>
    initialFormData(userEmail)
  );
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function setField<K extends keyof MembershipFormData>(
    field: K,
    value: MembershipFormData[K]
  ) {
    setData((prev) => ({ ...prev, [field]: value }));
    // Clear error on edit
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  async function handleNext() {
    const stepErrors = validateStep(step, data);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});

    if (step === TOTAL_STEPS - 1) {
      // Submit
      setSubmitting(true);
      setSubmitError(null);
      try {
        const result = await onSubmit(data);
        if (!result.ok) {
          setSubmitError(result.error ?? "An unexpected error occurred.");
        }
        // On success the parent handles redirect; nothing to do here
      } catch {
        setSubmitError("An unexpected error occurred. Please try again.");
      } finally {
        setSubmitting(false);
      }
    } else {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleBack() {
    setErrors({});
    setStep((s) => s - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const isLastStep = step === TOTAL_STEPS - 1;

  // ─── Step headers ──────────────────────────────────────────────────────────

  const stepMeta: { eyebrow: string; heading: string }[] = [
    {
      eyebrow: "Registration · Athlete",
      heading: "About the Athlete",
    },
    {
      eyebrow: "Registration · Contact",
      heading: "Main Contact",
    },
    {
      eyebrow: "Registration · Emergency",
      heading: "Primary Emergency Contact",
    },
    {
      eyebrow: "Registration · Emergency",
      heading: "Secondary Emergency Contact",
    },
    {
      eyebrow: "Registration · Medical",
      heading: "Medical Information",
    },
    {
      eyebrow: "Registration · Waivers",
      heading: "Agreements & Waivers",
    },
  ];

  const meta = stepMeta[step];
  const isWaiverStep = step === 5;

  // ─── Navigation bar ────────────────────────────────────────────────────────

  const navBar = (
    <div className="flex items-center justify-between gap-4 mt-8">
      {step > 0 ? (
        <Button variant="secondary" type="button" onClick={handleBack} disabled={submitting}>
          Back
        </Button>
      ) : (
        <div />
      )}
      <Button
        type="button"
        onClick={handleNext}
        disabled={submitting}
      >
        {submitting
          ? "Submitting…"
          : isLastStep
          ? "Submit"
          : "Next"}
      </Button>
    </div>
  );

  // ─── Content ───────────────────────────────────────────────────────────────

  const stepContent = (
    <>
      {step === 0 && (
        <Step0AthleteInfo data={data} onChange={setField} errors={errors} />
      )}
      {step === 1 && (
        <Step1MainContact data={data} onChange={setField} errors={errors} />
      )}
      {step === 2 && (
        <Step2EC1 data={data} onChange={setField} errors={errors} />
      )}
      {step === 3 && (
        <Step3EC2 data={data} onChange={setField} errors={errors} />
      )}
      {step === 4 && (
        <Step4Medical data={data} onChange={setField} />
      )}
      {step === 5 && (
        <Step5Waivers data={data} onChange={setField} errors={errors} />
      )}
    </>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  if (isWaiverStep) {
    return (
      <div>
        {/* Progress — light zone */}
        <div className="bg-paper px-6 py-6 md:px-12">
          <ProgressIndicator step={step} />
        </div>

        {/* Waiver content — dark zone */}
        <div className="bg-purple-950 px-6 py-10 md:px-12">
          <div className="max-w-2xl mx-auto">
            <div className="mb-8">
              <Eyebrow className="text-brass">{meta.eyebrow}</Eyebrow>
              <h2 className="font-display text-bone text-3xl md:text-4xl mt-2 tracking-tight">
                {meta.heading}
              </h2>
              <StripRule className="mt-5" />
            </div>

            {stepContent}

            {submitError && (
              <p
                className="mt-6 text-red-400 text-sm bg-red-950/20 border border-red-400/30 px-4 py-3"
                role="alert"
              >
                {submitError}
              </p>
            )}

            <div className="flex items-center justify-between gap-4 mt-8">
              <Button variant="secondary" type="button" onClick={handleBack} disabled={submitting} className="border-bone/30 text-bone hover:bg-bone hover:text-ink">
                Back
              </Button>
              <Button type="button" onClick={handleNext} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-paper px-6 py-10 md:px-12">
      <div className="max-w-2xl mx-auto">
        <ProgressIndicator step={step} />

        <div className="mt-8 mb-6">
          <Eyebrow>{meta.eyebrow}</Eyebrow>
          <h2 className="font-display text-ink text-3xl md:text-4xl mt-2 tracking-tight">
            {meta.heading}
          </h2>
          <StripRule className="mt-5" />
        </div>

        {stepContent}

        {submitError && (
          <p
            className="mt-6 text-red-600 text-sm bg-red-50 border border-red-200 px-4 py-3"
            role="alert"
          >
            {submitError}
          </p>
        )}

        {navBar}
      </div>
    </div>
  );
}

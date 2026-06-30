"use client";

import { useState } from "react";
import {
  MembershipFormData,
  WeaponClass,
  SexAtBirth,
  ShirtSize,
  MEMBERSHIP_SEASON,
} from "@/lib/member-types";
import { Button } from "@/components/Button";
import { Eyebrow } from "@/components/Eyebrow";
import { StripRule } from "@/components/StripRule";
import { FormField } from "./FormField";

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = {
  userEmail: string;
  // Pre-filled values: shared contact/address when adding another family member,
  // or a member's full record when editing. contact_email always stays the
  // account login email.
  defaults?: Partial<MembershipFormData>;
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
  { value: "foil-youth", label: "Foil Youth (ages 8–11)" },
  { value: "foil-adult", label: "Foil Adult (ages 12 & up)" },
  { value: "epee",       label: "Épée (Mon 6:30p)" },
  { value: "saber",      label: "Saber (Thu 6:30p)" },
];

const YOUTH_SHIRT_SIZES: ShirtSize[] = ["YXS", "YS", "YM", "YL", "YXL"];
const ADULT_SHIRT_SIZES: ShirtSize[] = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

// ─── Minor detection ──────────────────────────────────────────────────────────

function calculateAge(birthday: string): number {
  if (!birthday) return 99;
  const today = new Date();
  const dob = new Date(birthday);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

const SEX_OPTIONS: { value: SexAtBirth; label: string }[] = [
  { value: "male",   label: "Male" },
  { value: "female", label: "Female" },
];

const STEP_LABELS = [
  "Athlete Info",
  "Main Contact",
  "Emergency Contact 1",
  "Emergency Contact 2",
  "Medical",
  "Waivers",
];

// ═══════════════════════════════════════════════════════════════════════════════
// VERBATIM AGREEMENT TEXT  —  POPULATED BY CONTENT SUBAGENT
// ═══════════════════════════════════════════════════════════════════════════════
//
// CONTENT AGENT INSTRUCTIONS:
//   Replace every value marked `__VERBATIM__` below with the EXACT text from
//   `releases document.txt` in the project root. Copy the wording, punctuation,
//   capitalization, and bullet/line structure CHARACTER-FOR-CHARACTER.
//
//   The ONLY permitted change is the season year: any "2024-25", "2025-26",
//   or "2025-2026" reference becomes "2026-27". (The two waiver *headers* already
//   interpolate the season via MEMBERSHIP_SEASON — do not touch those.)
//
//   Each constant maps to a specific span of releases document.txt:
//     RULES_OF_CLUB_BODY          → lines 2–26  (bullets + "Waiver of Liability:" para)
//     RULES_OF_CLUB_ATHLETE_ACK   → line 27     ("Athlete has read and understands…")
//     RULES_OF_CLUB_GUARDIAN_ACK  → line 30     ("Parent or Guardian has read…")
//     ATHLETE_COC_BODY            → lines 33–41 (bullets + "I have read the USA Fencing
//                                                Athlete Code of Conduct…" statement)
//     ATHLETE_COC_ACK             → line 42     ("Athlete has read and understands…")
//     PARENT_COC_BODY             → lines 46–61 (bullets + "I have read the USA Fencing
//                                                Parent Code of Conduct…" statement)
//     PARENT_COC_ACK              → line 62     ("Parent or Guardian has read…")
//     INDIVIDUAL_WAIVER_BODY      → lines 65–89 ("READ BEFORE SIGNING" through the
//                                                FOR PARENTS/GUARDIANS … minor-age para)
//     MAAPP_BODY                  → lines 98–101 (agreement para + "CLICK HERE …" line)
//
//   Use real newlines inside the strings (the text renders with whitespace-pre-wrap,
//   so blank lines and bullet line-breaks are preserved). Do NOT edit anything
//   outside these constants. Do NOT change the two ACK constants for the Individual
//   Waiver / MAAPP — those agreements have no acknowledgment sentence in the source
//   and intentionally use the generic caption defined inline below.
//
const VERBATIM_PLACEHOLDER = "__VERBATIM__"; // sentinel — must not survive into the UI

const RULES_OF_CLUB_BODY = `- DMFC is a 100% volunteer club.

- Members(or a parent of student)are required to volunteer 16-20 hours each year August 1 to July 31st(prorated).

- Dues for the 2026-27 season are:
     Annual registration fee                  = $65
     Monthly base membership fee    = $50 plus
     Monthly class fee                           = $20

- Make regular payments and be in good financial standing with the club at all times.

- Equipment fees are paid prior to order.

- DMFC maintains a member scholarship program and if needed, a member needs to request a scholarship form by emailing DMFCPresident@gmail.com or speaking to a coach.

- Substance abuse is not tolerated at the Des Moines Fencing Club or any of its functions.

- Any member not following the safety rules as outlined by the USA Fencing may face disciplinary actions.

- Behavior that is rude, disrespectful, disruptive and/or hostile will not be tolerated by any member or guest of DMFC will result in disciplinary action.

- As a member, you are required to maintain an active membership with the USA Fencing in good standing. Failure to do so will result in disciplinary action.

Waiver of Liability:
Upon entering practices and/or events sponsored by the DMFC, I agree to abide by the rules of the DMFC and the USFA, as currently published. I understand and appreciate that participation in a sport carries a risk to me of serious injury, including permanent paralysis or death. I voluntarily and knowingly recognize, accept and assume this risk and release the DMFC and the USFA from any liability.`;
const RULES_OF_CLUB_ATHLETE_ACK = "Athlete has read and understands the above and will abide";
const RULES_OF_CLUB_GUARDIAN_ACK = "Parent or Guardian has  read and understands the above and will abide";
const ATHLETE_COC_BODY = `- Fence for fun.
- Work hard to improve your skills.
- Learn sportsmanship, discipline and teamwork.
- Learn the rules and play by them. Always be a good sport.
- Respect your coach, other athletes, your parents, opponents and officials.
- Never argue with an official’s decision.

I have read the USA Fencing Athlete Code of Conduct. I understand its requirements and agree
to abide by the letter and spirit of the USA Fencing Code of Conduct.`;
const ATHLETE_COC_ACK = "Athlete has  read and understands the above and will abide";
const PARENT_COC_BODY = `Support your child’s desire to participate in fencing. Children are involved in organized
sports for fun, health and development.

- Encourage your child to play by the rules. Remember, children learn best by example, so
applaud the competition of each participant.

- Emphasize skill development and practice and how they benefit the athlete. De-emphasize
events and competition in the lower age groups.

- Know and study the rules of fencing. Refrain from criticizing the officials. Respect their authority and decisions during bouts.

- Applaud a good effort in both victory and defeat. Enforce the positive points of the
competition. Never yell or physically abuse your child at a competition or practice. Assist USA Fencing in removing the physical and verbal abuse in sports.

I have read the USA Fencing Parent Code of Conduct. I understand its requirements and agree
to abide by the letter and spirit of the USA Fencing Parent Code of Conduct.  `;
const PARENT_COC_ACK = "Parent or Guardian has read and understands the above and will abide";
const INDIVIDUAL_WAIVER_BODY = `READ BEFORE SIGNING
In consideration and as a condition of my and/or my minor child’s being granted membership in the United States Fencing Association (“USA Fencing”) and/or being allowed to participate in any way in USA Fencing and its related events and activities, I acknowledge and agree, on my own behalf and on behalf of any child or other person for whom I am signing this document (“I” or “myself” or “my” being construed hereinafter to include all such persons), as follows:
SUBMISSION TO RULES:

I agree to abide by the current rules and policies of USA Fencing as set forth in, among other things, the Bylaws, Rules of Competition, Athlete Handbook, Operations Manual, USA Fencing Safe Sport Policy, US Center for Safesport Code for the US Olympic and Paralympic movement (including the Practices and Procedures and Supplementary Rules appended thereto) and USADA Rules, all as now constituted and as may be amended from time to time. You recognize that USA Fencing has the right to adjust, modify, add to, or otherwise amend its Bylaws, rules, policies, and procedures, the current versions of which will be available on the USA Fencing website.

CLICK HERE - https://www.usafencing.org/maapp

to review USA Fencing's Minor Athlete Abuse Prevention Policies (MAAPP).

ASSUMPTION OF RISK, WAIVER AND RELEASE OF LIABILITY: I acknowledge and agree as follows: The risks of injury from the activities involved in the sport of fencing and related activities are significant, including the potential for serious injury, disability or death, and while particular skills, equipment, and personal discipline may reduce those risks, the risks may continue to exist; and, I KNOWINGLY AND FREELY ASSUME ALL SUCH RISKS, whether known or unknown, apparent or latent, EVEN IF ARISING FROM THE NEGLIGENCE OF THE RELEASEES (defined below) or others, and assume full responsibility for my participation; and, I, for myself and on behalf of my heirs, assigns, personal representatives and next of kin, HEREBY RELEASE, INDEMNIFY AND HOLD HARMLESS USA FENCING, and all affiliated sections, divisions, clubs, host organizations, officers, directors, athletes, referees, coaches, volunteers, officials, club members, individual members, agents, employees, contractors, participants, sponsoring agencies, sponsors, advertisers, and, if applicable, owners or lessors of premises used for the activity (“Releasees”), WITH RESPECT TO ANY AND ALL CLAIMS, DEMANDS AND CAUSES OF ACTION ALLEGING OR ARISING FROM ANY PERSONAL INJURY, DISABILITY, DEATH, or loss or damage to person or property, that may occur or has occurred, in connection with the sport of fencing or related activities, WHETHER OR NOT ARISING FROM THE NEGLIGENCE OF ANY OF THE RELEASEES, to the fullest extent permitted by law.

I HAVE READ THIS ASSUMPTION OF RISK, WAIVER AND RELEASE OF LIABILITY AGREEMENT FULLY, UNDERSTAND ITS TERMS, UNDERSTAND THAT I HAVE GIVEN UP SUBSTANTIAL RIGHTS BY SIGNING IT, AND SIGN IT FREELY AND VOLUNTARILY.

FINANCIAL OBLIGATIONS: It is the duty of every member to remain in good financial standing with the USFA. Notwithstanding any provision of these Bylaws to the contrary, the membership rights of any member who is more than ninety (90) days in arrears on any amount owed to the USFA will be administratively suspended without further action than notice given to the member’s email address or mailing address of record. Such suspension is not considered disciplinary action and is not contingent on any procedures regarding the same. However, any member who contests such action may file a complaint and have the validity and amount of the claimed balance due established under the procedures prescribed for the resolution of grievances.

DRUG TESTING: I understand that, pursuant to the rules and regulations of USA Fencing, the FIE, the IWAS, the USOPC, the US Anti-Doping Agency (“USADA”) and/or the World Anti-Doping Agency, drug testing may be conducted for athletes who compete in tournaments conducted, sponsored and/or sanctioned by USA Fencing, and that detection of the use of banned drugs would be cause for penalties including but not limited to disqualification and suspension for a period of time, based upon factors including the substance(s) detected. In consideration of being granted membership in USA Fencing and/or being allowed to participate in any way in the USA Fencing and its related events and activities, I agree to familiarize myself with and to comply with the FIE and the IWAS Anti-Doping Rules and USADA’s Protocol for Olympic and Paralympic Movement Testing (USADA Protocol) and all other applicable anti-doping rules and policies adopted by the FIE, the IWAS, USADA, and the USOPC. Without limiting the generality of the foregoing, I consent to be subject to drug testing and to penalties if declared positive for a banned substance. I am aware that failure to comply with any selection for a drug test will be cause for the same penalties as for those who are positive for a banned substance. If it is determined that I may have committed a doping violation, I agree to submit to the results management authority and processes of USADA, including arbitration under the USADA Protocol, or to the results management authority of the FIE or the IWAS and or my national federation, if applicable or referred by USADA. I realize that there are OVER-THE COUNTER medications that may contain banned substances and that it is my responsibility to insure that I do not inadvertently take any medication that contains a banned substance. I know that I may check the prohibited status at GlobalDRO.com or visit Supplement411.org. For questions about medications and banned substances or practices you may also call the Athlete Express at 866-601-2632. CONSENT FOR MEDICAL TREATMENT: This is to certify that I give my written consent to the USA Fencing and its representatives for myself and/or any person for whom I am signing this document to obtain medical care from any licensed physician, athletic trainer, hospital or clinic for any injury or illness that may arise during fencing and related activities. QUALIFICATION (Championships and NACs): I understand that some individual events require qualification and that my entry or entries will remain pending until qualification is confirmed. I further understand that, should I not meet the stated qualification, I will be withdrawn from the event and a refund will be processed on my behalf. CHOICE OF LAW: The foregoing agreement, consent, waiver and release shall be governed, interpreted and construed according to the law of the State of Colorado, without reference to choice of law principles.


ARBITRATION: Except as set forth in the Safe Sport Code promulgated by the US Center For Safe Sport (including the Practices and Procedures and Supplementary Rules appended thereto), any controversy or claim arising from or relating to my membership or participation, or my minor child’s membership or participation, in USA Fencing, including but not limited to any matter arising from or relating to (i) qualification or selection for, or competition in, any fencing event, whether staged under the auspices of USA Fencing, the FIE, the IWAS, the USOPC, the IOC or some other fencing administrative body, (ii) qualification or selection for, or activities as, a coach, referee or other official at any such fencing event; or (iii) compliance with or violation of any rule, regulation, policy, practice, bylaw, statute or common law, of USA Fencing, FIE, IWAS, USOPC or IOC, or of any national, state, provincial or local governing or administrative body, including any issue concerning compliance by USA Fencing or by any officer, director, employee, agent, attorney, referee, official, club member, individual member, committee member or volunteer of USA Fencing, including but not limited to any matter arising from or relating to allegations of damage to property or injury to person, shall to the fullest extent permitted by law be settled by arbitration, provided, however, that prior to the commencement of any such arbitration, any and all available administrative procedures and remedies of USA Fencing, FIE, USOPC, IWAS, IOC or applicable sports, governmental or administrative body shall have been exhausted.


Any arbitration shall be administered by the American Arbitration Association in accordance with its Commercial Arbitration Rules and judgment on the award rendered by the arbitrator(s) may be entered in any court having jurisdiction thereof. The arbitration shall be governed by the laws of the State of Colorado and the United States, conducted in Colorado Springs, Colorado. The arbitration shall be commenced within any time limit(s), and its scope shall not exceed any limitations, set forth in the Grievance and Disciplinary Procedures set forth in the Athlete Handbook. The arbitrator(s) will have no authority or jurisdiction to award consequential, punitive or exemplary damages, and any demand for such damages shall be a nullity. Except as may be required by law or as reasonably required to enforce or appeal from an arbitration award or as noted above, arbitration proceedings shall be kept confidential, and neither a party, an attorney for a party, a witness, nor an arbitrator may disclose the existence, content, or results of any arbitration hereunder to a non-party without the prior written consent of all parties.

FOR PARENTS/GUARDIANS OF PARTICIPANTS OF MINORITY AGE (UNDER AGE 18 AT TIME OF REGISTRATION)This is to certify that I, as parent/guardian with legal responsibility for this participant, do consent and agree to his/her release as provided above of all the Releasees, and, for myself, my heirs, assigns, and next of kin, I release and agree to indemnify and hold harmless the Releasees from any and all liabilities incident to my minor child’s involvement or participation in these programs as provided above, EVEN IF ARISING FROM THE NEGLIGENCE OF THE RELEASEES, to the fullest extent permitted by law.`;
const PHOTO_RELEASE_BODY = `We love sharing moments from practices and events — it's one of the ways we celebrate our athletes and introduce new families to the sport.

By signing this release, I give the Des Moines Fencing Club permission to photograph and video record me or my child during club activities, and to use those images on the club website, social media, newsletters, and other promotional materials. Images will only be used for club-related purposes, and no payment is owed for their use.

Photos may be cropped or edited as needed. Because we post regularly, we aren't able to seek individual approval before each use — but we'll always represent our athletes with care and respect.

This permission covers the current membership season and renews each season I maintain an active DMFC membership.`;
const PHOTO_RELEASE_ACK = `I have read the photo and video release above and, as the athlete or parent/guardian of the athlete named in this form, I agree to its terms.`;
const PHOTO_RELEASE_HEADER = "Photo & Video Release";

const MAAPP_BODY = `I agree to abide by the current rules and policies of USA Fencing as set forth in, among other things, the Bylaws, Rules of Competition, Athlete Handbook, Operations Manual, USA Fencing Safe Sport Policy, US Center for Safesport Code for the US Olympic and Paralympic movement (including the Practices and Procedures and Supplementary Rules appended thereto) and USADA Rules, all as now constituted and as may be amended from time to time. I agree to abide by any updates made to these policies during the membership season. These updates will be communicated to membership through email.

CLICK HERE - https://www.usafencing.org/maapp
to review USA Fencing's Minor Athlete Abuse Prevention Policies (MAAPP).`;

// Agreement section headers (verbatim from the source; not season-interpolated).
const RULES_OF_CLUB_HEADER = "Rules of the Club";
const ATHLETE_COC_HEADER = "Athlete Code of Conduct (non-National Team member)";
const PARENT_COC_HEADER = "USA Fencing Parent Code of Conduct";
// These two carry the season year, which is normalized to the current season.
const INDIVIDUAL_WAIVER_HEADER = `${MEMBERSHIP_SEASON} Individual Membership Waiver`;
const MAAPP_HEADER = `${MEMBERSHIP_SEASON} MAAPP Waiver`;

// The MAAPP policy link, surfaced as a clickable link beneath the body text
// (the body also contains the "CLICK HERE - <url>" line verbatim).
const MAAPP_LINK = {
  label: "Review USA Fencing's Minor Athlete Abuse Prevention Policies (MAAPP)",
  href: "https://www.usafencing.org/maapp",
};

// ═══════════════════════════════════════════════════════════════════════════════

// ─── Initial form state ───────────────────────────────────────────────────────

function initialFormData(
  userEmail: string,
  defaults?: Partial<MembershipFormData>
): MembershipFormData {
  const base: MembershipFormData = {
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
    guardian_first_name: "",
    guardian_last_name: "",
    guardian_relationship: "",
    guardian_phone: "",
    medical_conditions: "",
    preferred_medical_system: "",
    rules_club_athlete_agreed: false,
    rules_club_athlete_signature: "",
    rules_club_guardian_agreed: false,
    rules_club_guardian_signature: "",
    athlete_coc_agreed: false,
    athlete_coc_signature: "",
    parent_coc_agreed: false,
    parent_coc_signature: "",
    individual_waiver_agreed: false,
    individual_waiver_signature: "",
    maapp_agreed: false,
    maapp_signature: "",
    photo_release_agreed: false,
    photo_release_signature: "",
  };
  // Merge any pre-filled values over the blank base, but keep contact_email
  // pinned to the account login email.
  return { ...base, ...(defaults ?? {}), contact_email: userEmail };
}

// ─── Validation ───────────────────────────────────────────────────────────────

// Null-safe blank check — tolerates fields that may be transiently `undefined`
// (e.g. stale component state after a dev-server Fast Refresh adds new fields).
function isBlank(v: string | undefined): boolean {
  return !v || !v.trim();
}

function validateStep(step: number, data: MembershipFormData): Errors {
  const errs: Errors = {};
  const isMinor = calculateAge(data.birthday) < 18;

  if (step === 0) {
    if (!data.first_name.trim()) errs.first_name = "First name is required.";
    if (!data.last_name.trim())  errs.last_name  = "Last name is required.";
    if (!data.birthday)          errs.birthday   = "Birthday is required.";
    if (!data.sex_at_birth)      errs.sex_at_birth = "Please select an option.";
    if (data.weapon_classes.length === 0) errs.weapon_classes = "Select at least one class.";
  }

  if (step === 1) {
    if (isMinor) {
      if (!data.guardian_first_name.trim()) errs.guardian_first_name = "Guardian first name is required.";
      if (!data.guardian_last_name.trim())  errs.guardian_last_name  = "Guardian last name is required.";
      if (!data.guardian_relationship.trim()) errs.guardian_relationship = "Relationship is required.";
      if (!data.guardian_phone.trim()) errs.guardian_phone = "Guardian phone is required.";
    }
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
    // 1. Rules of the Club — athlete always
    if (isBlank(data.rules_club_athlete_signature)) errs.rules_club_athlete_signature = "Signature is required.";
    if (!data.rules_club_athlete_agreed) errs.rules_club_athlete_agreed = "You must agree to continue.";
    // …guardian too, when the athlete is a minor
    if (isMinor) {
      if (isBlank(data.rules_club_guardian_signature)) errs.rules_club_guardian_signature = "Signature is required.";
      if (!data.rules_club_guardian_agreed) errs.rules_club_guardian_agreed = "You must agree to continue.";
    }

    // 2. Athlete Code of Conduct — athlete always
    if (isBlank(data.athlete_coc_signature)) errs.athlete_coc_signature = "Signature is required.";
    if (!data.athlete_coc_agreed) errs.athlete_coc_agreed = "You must agree to continue.";

    // 3. Parent Code of Conduct — minors only
    if (isMinor) {
      if (isBlank(data.parent_coc_signature)) errs.parent_coc_signature = "Signature is required.";
      if (!data.parent_coc_agreed) errs.parent_coc_agreed = "You must agree to continue.";
    }

    // 4. Individual Membership Waiver — always (signer derived from age)
    if (isBlank(data.individual_waiver_signature)) errs.individual_waiver_signature = "Signature is required.";
    if (!data.individual_waiver_agreed) errs.individual_waiver_agreed = "You must agree to continue.";

    // 5. MAAPP Waiver — always (signer derived from age)
    if (isBlank(data.maapp_signature)) errs.maapp_signature = "Signature is required.";
    if (!data.maapp_agreed) errs.maapp_agreed = "You must agree to continue.";

    // 6. Photo & Video Release — always (signer derived from age)
    if (isBlank(data.photo_release_signature)) errs.photo_release_signature = "Signature is required.";
    if (!data.photo_release_agreed) errs.photo_release_agreed = "You must agree to continue.";
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

// One signer's portion of a waiver block (signature + agreement checkbox).
// A single agreement may have one signer (most) or two (Rules of the Club,
// when the athlete is a minor: athlete + guardian).
type WaiverSigner = {
  fieldKey: string;       // unique base for input id/name
  signerLabel: string;    // "Athlete" | "Parent or guardian"
  acknowledgment: string; // caption rendered beside the agree checkbox
  agreed: boolean;
  onAgreed: (v: boolean) => void;
  agreedError?: string;
  signature: string;
  onSignature: (v: string) => void;
  signatureError?: string;
};

function WaiverBlock({
  header,
  body,
  scrollable,
  links,
  signers,
}: {
  header: string;
  body: string;
  scrollable?: boolean;
  links?: { label: string; href: string }[];
  signers: WaiverSigner[];
}) {
  return (
    <div className="border border-brass/30 p-6 flex flex-col gap-5">
      <div>
        <h3 className="font-display text-bone text-xl mb-3">{header}</h3>
        <div
          className={cx(
            "border border-brass/20 bg-purple-900/40 px-4 py-3 text-[13px] text-bone/70 leading-relaxed whitespace-pre-wrap",
            scrollable && "h-64 overflow-y-auto"
          )}
        >
          {body}
        </div>
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

      {signers.map((s, i) => (
        <div key={s.fieldKey} className="flex flex-col gap-5">
          {/* Divider + signer name only when the block has more than one signer */}
          {signers.length > 1 && (
            <>
              {i > 0 && <StripRule />}
              <p className="text-brass text-xs font-semibold uppercase tracking-[0.12em]">
                {s.signerLabel}
              </p>
            </>
          )}

          {/* Typed signature */}
          <FormField
            label={`${s.signerLabel} signature`}
            required
            error={s.signatureError}
            hint="Type your full legal name"
            htmlFor={`${s.fieldKey}_signature`}
            labelClassName="!text-brass"
          >
            <input
              id={`${s.fieldKey}_signature`}
              type="text"
              value={s.signature}
              onChange={(e) => s.onSignature(e.target.value)}
              placeholder="Your full name"
              className={cx(
                "w-full bg-purple-900 border px-3 py-2.5 text-[15px] text-bone/90 placeholder:text-bone/30 " +
                "focus:outline-none focus:ring-0 transition-colors duration-150 italic",
                s.signatureError ? "border-red-400" : "border-brass/40 focus:border-brass"
              )}
            />
          </FormField>

          {/* Agreement checkbox */}
          <FormField label="" error={s.agreedError}>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={s.agreed}
                onChange={(e) => s.onAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-brass flex-shrink-0"
              />
              <span className="text-bone/80 text-[15px] leading-relaxed group-hover:text-bone transition-colors">
                {s.acknowledgment}
              </span>
            </label>
          </FormField>
        </div>
      ))}
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
  const isMinor = calculateAge(data.birthday) < 18;

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

      {data.birthday && isMinor && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-300 text-amber-800 text-[13px] leading-snug">
          <span aria-hidden="true">⚠️</span>
          <span>Athlete is under 18 — parent or guardian information will be required on the next step.</span>
        </div>
      )}

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
  isMinor,
}: {
  data: MembershipFormData;
  onChange: <K extends keyof MembershipFormData>(field: K, value: MembershipFormData[K]) => void;
  errors: Errors;
  isMinor: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[15px] text-mute leading-relaxed border-l-2 border-brass pl-3">
        {isMinor
          ? "The athlete is under 18. Please provide a parent or guardian as the main contact."
          : "Who should we contact about membership matters? If the athlete is an adult, this is usually the athlete themselves."}
      </p>

      {isMinor && (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <TextField
              id="guardian_first_name"
              label="Guardian First Name"
              value={data.guardian_first_name}
              onChange={(v) => onChange("guardian_first_name", v)}
              required
              error={errors.guardian_first_name}
            />
            <TextField
              id="guardian_last_name"
              label="Guardian Last Name"
              value={data.guardian_last_name}
              onChange={(v) => onChange("guardian_last_name", v)}
              required
              error={errors.guardian_last_name}
            />
          </div>
          <TextField
            id="guardian_relationship"
            label="Relationship to Athlete"
            value={data.guardian_relationship}
            onChange={(v) => onChange("guardian_relationship", v)}
            required
            error={errors.guardian_relationship}
            placeholder="e.g. Mother, Father, Legal Guardian"
          />
          <TextField
            id="guardian_phone"
            label="Guardian Phone"
            type="tel"
            value={data.guardian_phone}
            onChange={(v) => onChange("guardian_phone", v)}
            required
            error={errors.guardian_phone}
            placeholder="(515) 555-0100"
          />
        </>
      )}

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
          id="ec1_first_name"
          label="First Name"
          value={data.ec1_first_name}
          onChange={(v) => onChange("ec1_first_name", v)}
          required
          error={errors.ec1_first_name}
        />
        <TextField
          id="ec1_last_name"
          label="Last Name"
          value={data.ec1_last_name}
          onChange={(v) => onChange("ec1_last_name", v)}
          required
          error={errors.ec1_last_name}
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
  isMinor,
}: {
  data: MembershipFormData;
  onChange: <K extends keyof MembershipFormData>(field: K, value: MembershipFormData[K]) => void;
  errors: Errors;
  isMinor: boolean;
}) {
  const ATHLETE = "Athlete";
  const GUARDIAN = "Parent or guardian";
  // Agreements with a single, age-derived signer (Individual Waiver, MAAPP):
  // an adult athlete signs for themselves; for a minor, the guardian signs.
  const soleSigner = isMinor ? GUARDIAN : ATHLETE;
  // Generic acknowledgment for agreements whose source has no "I have read…"
  // sentence (the Individual Waiver and MAAPP only provide a signature line).
  const genericAck = (title: string) => `I have read and agree to the ${title}.`;

  return (
    <div className="flex flex-col gap-8">
      {/* 1. Rules of the Club — athlete always; guardian also when minor */}
      <WaiverBlock
        header={RULES_OF_CLUB_HEADER}
        body={RULES_OF_CLUB_BODY}
        scrollable
        signers={[
          {
            fieldKey: "rules_club_athlete",
            signerLabel: ATHLETE,
            acknowledgment: RULES_OF_CLUB_ATHLETE_ACK,
            agreed: data.rules_club_athlete_agreed,
            onAgreed: (v) => onChange("rules_club_athlete_agreed", v),
            agreedError: errors.rules_club_athlete_agreed,
            signature: data.rules_club_athlete_signature,
            onSignature: (v) => onChange("rules_club_athlete_signature", v),
            signatureError: errors.rules_club_athlete_signature,
          },
          ...(isMinor
            ? [
                {
                  fieldKey: "rules_club_guardian",
                  signerLabel: GUARDIAN,
                  acknowledgment: RULES_OF_CLUB_GUARDIAN_ACK,
                  agreed: data.rules_club_guardian_agreed,
                  onAgreed: (v: boolean) => onChange("rules_club_guardian_agreed", v),
                  agreedError: errors.rules_club_guardian_agreed,
                  signature: data.rules_club_guardian_signature,
                  onSignature: (v: string) => onChange("rules_club_guardian_signature", v),
                  signatureError: errors.rules_club_guardian_signature,
                },
              ]
            : []),
        ]}
      />

      {/* 2. Athlete Code of Conduct — athlete signs */}
      <WaiverBlock
        header={ATHLETE_COC_HEADER}
        body={ATHLETE_COC_BODY}
        signers={[
          {
            fieldKey: "athlete_coc",
            signerLabel: ATHLETE,
            acknowledgment: ATHLETE_COC_ACK,
            agreed: data.athlete_coc_agreed,
            onAgreed: (v) => onChange("athlete_coc_agreed", v),
            agreedError: errors.athlete_coc_agreed,
            signature: data.athlete_coc_signature,
            onSignature: (v) => onChange("athlete_coc_signature", v),
            signatureError: errors.athlete_coc_signature,
          },
        ]}
      />

      {/* 3. Parent Code of Conduct — guardian signs (minors only) */}
      {isMinor && (
        <WaiverBlock
          header={PARENT_COC_HEADER}
          body={PARENT_COC_BODY}
          signers={[
            {
              fieldKey: "parent_coc",
              signerLabel: GUARDIAN,
              acknowledgment: PARENT_COC_ACK,
              agreed: data.parent_coc_agreed,
              onAgreed: (v) => onChange("parent_coc_agreed", v),
              agreedError: errors.parent_coc_agreed,
              signature: data.parent_coc_signature,
              onSignature: (v) => onChange("parent_coc_signature", v),
              signatureError: errors.parent_coc_signature,
            },
          ]}
        />
      )}

      {/* 4. Individual Membership Waiver — athlete (adult) or guardian (minor) */}
      <WaiverBlock
        header={INDIVIDUAL_WAIVER_HEADER}
        body={INDIVIDUAL_WAIVER_BODY}
        scrollable
        links={[MAAPP_LINK]}
        signers={[
          {
            fieldKey: "individual_waiver",
            signerLabel: soleSigner,
            acknowledgment: genericAck(INDIVIDUAL_WAIVER_HEADER),
            agreed: data.individual_waiver_agreed,
            onAgreed: (v) => onChange("individual_waiver_agreed", v),
            agreedError: errors.individual_waiver_agreed,
            signature: data.individual_waiver_signature,
            onSignature: (v) => onChange("individual_waiver_signature", v),
            signatureError: errors.individual_waiver_signature,
          },
        ]}
      />

      {/* 5. MAAPP Waiver — athlete (adult) or guardian (minor) */}
      <WaiverBlock
        header={MAAPP_HEADER}
        body={MAAPP_BODY}
        links={[MAAPP_LINK]}
        signers={[
          {
            fieldKey: "maapp",
            signerLabel: soleSigner,
            acknowledgment: genericAck(MAAPP_HEADER),
            agreed: data.maapp_agreed,
            onAgreed: (v) => onChange("maapp_agreed", v),
            agreedError: errors.maapp_agreed,
            signature: data.maapp_signature,
            onSignature: (v) => onChange("maapp_signature", v),
            signatureError: errors.maapp_signature,
          },
        ]}
      />

      {/* 6. Photo & Video Release — athlete (adult) or guardian (minor) */}
      <WaiverBlock
        header={PHOTO_RELEASE_HEADER}
        body={PHOTO_RELEASE_BODY}
        signers={[
          {
            fieldKey: "photo_release",
            signerLabel: soleSigner,
            acknowledgment: PHOTO_RELEASE_ACK,
            agreed: data.photo_release_agreed,
            onAgreed: (v) => onChange("photo_release_agreed", v),
            agreedError: errors.photo_release_agreed,
            signature: data.photo_release_signature,
            onSignature: (v) => onChange("photo_release_signature", v),
            signatureError: errors.photo_release_signature,
          },
        ]}
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

export function MembershipForm({ userEmail, defaults, onSubmit }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<MembershipFormData>(() =>
    initialFormData(userEmail, defaults)
  );
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Signer (athlete vs. parent/guardian) for each waiver is derived from the
  // athlete's age — no manual selector. See Step5Waivers.
  const isMinor = calculateAge(data.birthday) < 18;

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
        <Button variant="secondary" arrow="left" type="button" onClick={handleBack} disabled={submitting}>
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
        <Step1MainContact data={data} onChange={setField} errors={errors} isMinor={isMinor} />
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
        <Step5Waivers data={data} onChange={setField} errors={errors} isMinor={isMinor} />
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
              <Button variant="secondary" arrow="left" type="button" onClick={handleBack} disabled={submitting} className="!border-brass/40 !text-brass hover:!bg-brass hover:!text-ink">
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

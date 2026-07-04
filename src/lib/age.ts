// Age helpers shared between the client membership form and the server-side
// enrollment validation, so "is this athlete a minor" is computed exactly one
// way across the app rather than duplicated per caller.

/** Age in whole years as of today. Returns 99 for a blank/invalid birthday so
 *  callers gating on `< 18` treat "no birthday yet" as adult — the missing
 *  value itself is caught separately by the required-field check. */
export function calculateAge(birthday: string): number {
  if (!birthday) return 99;
  const today = new Date();
  const dob = new Date(birthday);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

export function isMinor(birthday: string): boolean {
  if (!birthday) return false;
  return calculateAge(birthday) < 18;
}

// Centralized admin/teacher access helpers.
// Add new authorized accounts here — no other code needs to change.

export const AUTHORIZED_ADMIN_EMAILS: readonly string[] = [
  "vset.official@gmail.com",
];

export const AUTHORIZED_TEACHER_EMAILS: readonly string[] = [
  // add teacher emails here
];

export function isAdminUser(email: string | null | undefined): boolean {
  if (!email) return false;
  return AUTHORIZED_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export function isTeacherUser(email: string | null | undefined): boolean {
  if (!email) return false;
  return AUTHORIZED_TEACHER_EMAILS.includes(email.trim().toLowerCase());
}

export function isStaffUser(email: string | null | undefined): boolean {
  return isAdminUser(email) || isTeacherUser(email);
}

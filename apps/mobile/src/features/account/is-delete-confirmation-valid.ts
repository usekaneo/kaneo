export function isDeleteConfirmationValid(
  confirmation: string,
  email: string | null | undefined,
) {
  if (!email) return false;
  return confirmation.trim().toLowerCase() === email.toLowerCase();
}

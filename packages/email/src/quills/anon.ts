/**
 * The email domain reserved for synthetic anonymous-user placeholders
 * ("temp-<id>@anon.quills.io"). The Better Auth anonymous plugin mints one
 * per anonymous user because it requires a unique non-null email — but the
 * address is never real and must never receive mail.
 *
 * This module is dependency-free on purpose: the email transport guards against
 * delivering here (see sendEmail in ./index), and apps/web re-exports these so
 * the auth plugin config and the realEmail() sanitizer share one definition.
 */
export const ANON_EMAIL_DOMAIN = "anon.quills.io";

const ANON_EMAIL_SUFFIX = `@${ANON_EMAIL_DOMAIN}`;

/** Whether an email is the synthetic anonymous placeholder (not a real address). */
export function isSyntheticAnonEmail(
  email: string | null | undefined,
): boolean {
  return !!email && email.toLowerCase().endsWith(ANON_EMAIL_SUFFIX);
}

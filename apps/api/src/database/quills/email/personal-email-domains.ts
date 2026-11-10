/**
 * Personal and free email providers, for telling a company address from a
 * personal one.
 *
 * The data is the MIT-licensed free-email-domains list, kept verbatim in
 * `free-email-domains.json`; its license is `free-email-domains.LICENSE.md`
 * beside this file. Refresh both together from the upstream dataset.
 *
 * Server-only: the list is about 270 KB, so client code never imports this
 * module (it is listed in the app's client import protection).
 */
import FREE_EMAIL_DOMAINS from "./free-email-domains.json";

/** Personal providers the upstream list does not carry. */
const ADDITIONAL_PERSONAL_DOMAINS = [
  "hey.com",
  "tutanota.com",
  "tuta.com",
  "tutamail.com",
];

const PERSONAL_DOMAINS: ReadonlySet<string> = new Set([
  ...FREE_EMAIL_DOMAINS,
  ...ADDITIONAL_PERSONAL_DOMAINS,
]);

/** True when the domain, or any parent domain of it, is a personal email provider. */
export function isPersonalEmailDomain(domain: string): boolean {
  let candidate = domain.trim().toLowerCase().replace(/\.$/, "");
  while (candidate.includes(".")) {
    if (PERSONAL_DOMAINS.has(candidate)) return true;
    candidate = candidate.slice(candidate.indexOf(".") + 1);
  }
  return false;
}

/** The lowercase domain of a well-formed address on a DNS name, or null. */
export function getEmailDomain(email: string): string | null {
  const parts = email.trim().split("@");
  if (parts.length !== 2 || !parts[0] || /[\s<>()[\]"\\]/.test(parts[0]))
    return null;
  const domain = (parts[1] ?? "").toLowerCase();
  if (
    domain.length > 253 ||
    !domain.includes(".") ||
    /^\d+(?:\.\d+){3}$/.test(domain)
  )
    return null;
  if (
    !domain
      .split(".")
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  )
    return null;
  return domain;
}

/** The address's domain when it belongs to a company rather than a personal provider. */
export function companyEmailDomain(email: string): string | null {
  const domain = getEmailDomain(email);
  return domain && !isPersonalEmailDomain(domain) ? domain : null;
}

import { DISPOSABLE_EMAIL_DOMAINS } from "./disposable-email-domains";

const DOMAIN_SET = new Set(
  DISPOSABLE_EMAIL_DOMAINS.map((d) => d.toLowerCase()),
);

export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return false;
  const host = email
    .slice(at + 1)
    .toLowerCase()
    .trim();
  if (!host) return false;

  // Match the host itself, or any parent domain. e.g. `dwv.dropmail.me` and
  // `dropmail.me` both match when `dropmail.me` is in the list.
  const parts = host.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const suffix = parts.slice(i).join(".");
    if (DOMAIN_SET.has(suffix)) return true;
  }
  return false;
}

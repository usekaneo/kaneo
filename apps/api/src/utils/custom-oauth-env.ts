import { isHttpUrl } from "./is-http-url";

export const MANAGED_PROFILE_FIELDS = ["name", "image", "locale"] as const;

export type ManagedProfileField = (typeof MANAGED_PROFILE_FIELDS)[number];

function isManagedProfileField(value: string): value is ManagedProfileField {
  return (MANAGED_PROFILE_FIELDS as readonly string[]).includes(value);
}

export function parseManagedProfileFields(
  raw = process.env.CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS,
): ManagedProfileField[] {
  const fields = new Set<ManagedProfileField>();
  for (const entry of (raw ?? "").split(",")) {
    const field = entry.trim().toLowerCase();
    if (!field) continue;
    if (!isManagedProfileField(field)) {
      throw new Error(
        `CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS accepts name, image and locale, not "${entry.trim()}".`,
      );
    }
    fields.add(field);
  }
  return MANAGED_PROFILE_FIELDS.filter((field) => fields.has(field));
}

export function parseCustomOAuthAccountUrl(
  raw = process.env.CUSTOM_OAUTH_ACCOUNT_URL,
): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (!isHttpUrl(value)) {
    throw new Error(
      "CUSTOM_OAUTH_ACCOUNT_URL must be an absolute http or https URL.",
    );
  }
  return new URL(value).href;
}

export function assertCustomOAuthEnv() {
  parseManagedProfileFields();
  parseCustomOAuthAccountUrl();
}

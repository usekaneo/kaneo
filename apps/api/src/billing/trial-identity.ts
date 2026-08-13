import { createHash } from "node:crypto";

const PLUS_TAG_PATTERN = /\+[^@]*/;

export function normalizeTrialEmail(email: string) {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf("@");

  if (atIndex <= 0) {
    return trimmed;
  }

  const local = trimmed.slice(0, atIndex).replace(PLUS_TAG_PATTERN, "");
  const domain = trimmed.slice(atIndex + 1);

  return local ? `${local}@${domain}` : trimmed;
}

export function hashTrialEmail(email: string) {
  return createHash("sha256").update(normalizeTrialEmail(email)).digest("hex");
}

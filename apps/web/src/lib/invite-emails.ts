import { z } from "zod/v4";

const emailSchema = z.email();

export type ParsedInviteEmails =
  | { ok: true; emails: string[] }
  | { ok: false; invalidIndexes: number[] };

export function parseInviteEmails(values: string[]): ParsedInviteEmails {
  const filled = values
    .map((value, index) => ({ email: value.trim(), index }))
    .filter(({ email }) => email);

  const invalidIndexes = filled
    .filter(({ email }) => !emailSchema.safeParse(email).success)
    .map(({ index }) => index);

  if (invalidIndexes.length > 0) {
    return { ok: false, invalidIndexes };
  }

  return {
    ok: true,
    emails: [...new Set(filled.map(({ email }) => email.toLowerCase()))],
  };
}

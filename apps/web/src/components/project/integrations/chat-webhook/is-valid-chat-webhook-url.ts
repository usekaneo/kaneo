import { z } from "zod/v4";

export function isValidChatWebhookUrl(value: string, pattern: RegExp): boolean {
  return z.url().safeParse(value).success && pattern.test(value);
}

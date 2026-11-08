export class TelegramHandleError extends Error {
  constructor() {
    super("Enter a valid Telegram username or user ID");
    this.name = "TelegramHandleError";
  }
}

const PREFIX = /^(?:https?:\/\/)?(?:t\.me|telegram\.me)\//i;
const USERNAME = /^[a-z][a-z0-9_]{4,31}$/i;
const NUMERIC = /^[1-9]\d{0,19}$/;

export function normalizeTelegramHandle(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== "string") throw new TelegramHandleError();

  const trimmed = input.trim();
  if (!trimmed) return null;

  const withoutPrefix = trimmed.replace(PREFIX, "");
  const withoutAt = withoutPrefix.replace(/^@/, "");

  if (NUMERIC.test(withoutAt) && Number.isSafeInteger(Number(withoutAt))) {
    return withoutAt;
  }
  if (USERNAME.test(withoutAt)) return withoutAt.toLowerCase();

  throw new TelegramHandleError();
}

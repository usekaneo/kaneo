// Keep these rules in sync with apps/api/src/user/telegram-handle.ts.
class TelegramHandleInputError extends Error {
  constructor() {
    super("Enter a valid Telegram username or user ID");
    this.name = "TelegramHandleInputError";
  }
}

const PREFIX = /^(?:https?:\/\/)?(?:t\.me|telegram\.me)\//i;
const USERNAME = /^[a-z][a-z0-9_]{4,31}$/i;
const NUMERIC = /^[1-9]\d{0,19}$/;

export function normalizeTelegramHandleInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withoutPrefix = trimmed.replace(PREFIX, "");
  const withoutAt = withoutPrefix.replace(/^@/, "");

  if (NUMERIC.test(withoutAt) && Number.isSafeInteger(Number(withoutAt))) {
    return withoutAt;
  }
  if (USERNAME.test(withoutAt)) return withoutAt.toLowerCase();

  throw new TelegramHandleInputError();
}

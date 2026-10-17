import { sanitizeText } from "../render/sanitize.js";

export type ErrorBody = {
  readonly message: string;
  readonly code: string | null;
  readonly missingPermissions: ReadonlyArray<string>;
};

export function parseErrorBody(text: string, status: number): ErrorBody {
  const body = readErrorBody(text, status);
  return {
    message: sanitizeText(body.message),
    code: body.code === null ? null : sanitizeText(body.code),
    missingPermissions: body.missingPermissions.map(sanitizeText),
  };
}

function readErrorBody(text: string, status: number): ErrorBody {
  const fallback = text.trim().slice(0, 500) || `HTTP ${status}`;
  try {
    const body: unknown = JSON.parse(text);
    if (typeof body !== "object" || body === null) {
      return { message: fallback, code: null, missingPermissions: [] };
    }
    const record = body as Record<string, unknown>;
    const message =
      typeof record.message === "string" && record.message.trim() !== ""
        ? record.message
        : typeof record.error === "string"
          ? record.error
          : fallback;
    const missing = Array.isArray(record.missingPermissions)
      ? record.missingPermissions.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    return {
      message,
      code: typeof record.code === "string" ? record.code : null,
      missingPermissions: missing,
    };
  } catch {
    return { message: fallback, code: null, missingPermissions: [] };
  }
}

export function parseRetryAfter(
  value: string | undefined,
  now: number,
): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  const date = Date.parse(value);
  return Number.isNaN(date)
    ? null
    : Math.max(0, Math.ceil((date - now) / 1000));
}

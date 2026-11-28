import { HttpError } from "@/lib/http-error";

export class PluginApiError extends HttpError {
  body: unknown;
  fieldErrors: Record<string, string>;

  constructor(
    status: number,
    message: string,
    body: unknown,
    fieldErrors: Record<string, string> = {},
  ) {
    super(status, message);
    this.name = "PluginApiError";
    this.body = body;
    this.fieldErrors = fieldErrors;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseResponseText(text: string): unknown {
  if (text.trim() === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function messageFrom(body: unknown): string | null {
  if (typeof body === "string" && body.trim() !== "") return body.trim();
  if (!isRecord(body)) return null;
  for (const key of ["message", "error"]) {
    const value = body[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return null;
}

function fieldErrorsFrom(body: unknown): Record<string, string> {
  if (!isRecord(body) || !isRecord(body.errors)) return {};
  return Object.fromEntries(
    Object.entries(body.errors).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export function toPluginApiError(
  status: number,
  statusText: string,
  text: string,
): PluginApiError {
  const body = parseResponseText(text);
  return new PluginApiError(
    status,
    messageFrom(body) ?? (statusText || `HTTP ${status}`),
    body,
    fieldErrorsFrom(body),
  );
}

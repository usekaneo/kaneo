import { SourceHttpError } from "../http.js";

const MAX_MESSAGE_LENGTH = 300;

export function jiraErrorText(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const record = body as Record<string, unknown>;
  const messages = [
    ...strings(record.errorMessages),
    ...strings(
      typeof record.errors === "object" && record.errors !== null
        ? Object.values(record.errors)
        : [],
    ),
  ];
  if (messages.length === 0 && typeof record.message === "string") {
    messages.push(record.message.trim());
  }
  const text = messages.filter(Boolean).join(" ");
  if (!text) return undefined;
  return text.length > MAX_MESSAGE_LENGTH
    ? `${text.slice(0, MAX_MESSAGE_LENGTH)}…`
    : text;
}

export function toJiraError(error: unknown, rejectedMessage: string): unknown {
  if (!(error instanceof SourceHttpError)) return error;
  if (error.status === 401) {
    return new SourceHttpError(rejectedMessage, 401, null);
  }
  const text = jiraErrorText(error.body);
  return text
    ? new SourceHttpError(`Jira: ${text}`, error.status, error.body)
    : error;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim());
}

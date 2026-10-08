export type ApiErrorIssue = { path: string; message: string };

export type ApiErrorDetails = {
  code?: string;
  issues?: ApiErrorIssue[];
  missingPermissions?: string[];
};

function isIssueList(value: unknown): value is ApiErrorIssue[] {
  return (
    Array.isArray(value) &&
    value.every(
      (issue) =>
        typeof issue === "object" &&
        issue !== null &&
        typeof issue.path === "string" &&
        typeof issue.message === "string",
    )
  );
}

function isStringList(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

export function parseApiErrorBody(
  text: string,
): ({ message: string } & ApiErrorDetails) | null {
  if (!text) return null;

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const body = value as Record<string, unknown>;
  const message =
    typeof body.message === "string"
      ? body.message
      : typeof body.error === "string"
        ? body.error
        : null;
  if (message === null) return null;

  return {
    message,
    ...(typeof body.code === "string" ? { code: body.code } : {}),
    ...(isIssueList(body.issues) ? { issues: body.issues } : {}),
    ...(isStringList(body.missingPermissions)
      ? { missingPermissions: body.missingPermissions }
      : {}),
  };
}

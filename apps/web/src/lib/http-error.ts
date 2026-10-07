import {
  type ApiErrorDetails,
  type ApiErrorIssue,
  parseApiErrorBody,
} from "./parse-api-error-body";

export class HttpError extends Error {
  status: number;
  code?: string;
  issues?: ApiErrorIssue[];
  missingPermissions?: string[];

  constructor(status: number, message: string, details: ApiErrorDetails = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = details.code;
    this.issues = details.issues;
    this.missingPermissions = details.missingPermissions;
  }

  static async fromResponse(
    response: Pick<Response, "status" | "text">,
  ): Promise<HttpError> {
    const text = await response.text().catch(() => "");
    const body = parseApiErrorBody(text);
    return body
      ? new HttpError(response.status, body.message, body)
      : new HttpError(response.status, text);
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof HttpError) return error.status === 401;
  // Recognize HttpError-shaped values even when their prototype differs.
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "HttpError" &&
    "status" in error &&
    error.status === 401
  );
}

// Shared unauthorized redirect for both the React Query error cache and direct
// fetcher calls (e.g. route loaders) that bypass the QueryCache. Stashes the
// current pathname/search/hash so the sign-in page can return the user to
// where they were instead of dropping them on /dashboard.
export function handleUnauthorized(): void {
  const currentPath =
    window.location.pathname + window.location.search + window.location.hash;
  const target = currentPath
    ? `/auth/sign-in?redirect=${encodeURIComponent(currentPath)}`
    : "/auth/sign-in";
  window.location.replace(target);
}

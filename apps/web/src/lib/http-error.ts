import i18n from "i18next";
import {
  type ApiErrorDetails,
  type ApiErrorIssue,
  parseApiErrorBody,
} from "./parse-api-error-body";

function fallbackMessage(status: number): string {
  if (status >= 500) {
    return i18n.t("common:error.messages.server", {
      defaultValue: "Server error. Please try again later.",
    });
  }
  return i18n.t("common:error.messages.unknown", {
    defaultValue: "An unexpected error occurred.",
  });
}

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
    const message =
      (body ? body.message : text).trim() || fallbackMessage(response.status);
    return new HttpError(response.status, message, body ?? {});
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  // Recognize HttpError-shaped values even when their prototype differs.
  const isHttpError =
    error instanceof HttpError ||
    ("name" in error && error.name === "HttpError");
  if (!isHttpError || !("status" in error) || error.status !== 401) {
    return false;
  }
  const code = "code" in error ? error.code : undefined;
  return code === undefined || code === "UNAUTHORIZED";
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

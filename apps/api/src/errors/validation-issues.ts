import type { ApiErrorIssue } from "./api-error";

export type ValidationIssueInput = {
  path?: readonly PropertyKey[];
  message?: string;
};

const TARGET_PREFIXES: Record<string, string> = {
  json: "body",
  form: "body",
  query: "query",
  param: "params",
  header: "header",
  cookie: "cookie",
};

function joinPath(segments: readonly PropertyKey[] | undefined) {
  return (segments ?? []).map((segment) => String(segment)).join(".");
}

export function formatValidationIssues(
  issues: readonly ValidationIssueInput[],
  target?: string,
): { message: string; issues: ApiErrorIssue[] } {
  const prefix = target ? TARGET_PREFIXES[target] : undefined;
  const first = issues[0];
  const firstField = joinPath(first?.path);

  return {
    message: first
      ? `${firstField || "request"}: ${first.message ?? "Invalid value"}`
      : "Invalid request",
    issues: issues.map((issue) => {
      const field = joinPath(issue.path);
      return {
        path: [prefix, field].filter(Boolean).join("."),
        message: issue.message ?? "Invalid value",
      };
    }),
  };
}

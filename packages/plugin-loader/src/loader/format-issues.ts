import type { StandardSchemaIssue } from "@kaneo/plugin-sdk";

function formatPath(path: StandardSchemaIssue["path"]): string {
  return (path ?? [])
    .map((segment) =>
      String(typeof segment === "object" ? segment.key : segment),
    )
    .join(".");
}

export function formatIssues(issues: readonly StandardSchemaIssue[]): string {
  return issues
    .map((issue) => `${formatPath(issue.path) || "options"}: ${issue.message}`)
    .join("\n");
}

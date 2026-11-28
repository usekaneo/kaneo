export const tangledOutcomeCodes = [
  "branch_linked",
  "branch_unchanged",
  "branch_missing",
  "branch_unmatched",
  "branch_conflict",
  "task_not_found",
  "tag_ignored",
  "pull_request_unsupported",
  "upstream_failed",
  "repository_changed",
] as const;

export type TangledOutcomeCode = (typeof tangledOutcomeCodes)[number];
export type TangledOutcome = {
  eventType: "push" | "pull_request" | "reconciliation";
  outcome: "applied" | "skipped" | "failed";
  code: TangledOutcomeCode;
  ref: string | null;
};

export const CODE_JOB_STATUSES = [
  "queued",
  "dispatched",
  "running",
  "committing",
  "completed",
  "failed",
  "cancelled",
] as const;

export type CodeJobStatus = (typeof CODE_JOB_STATUSES)[number];

// queued ─dispatch─▶ dispatched ─claim─▶ running ─changeset─▶ committing ─▶ completed
// Every non-terminal state can fail; only states before committing can be
// cancelled, so a cancel never races the pull request Kaneo is creating.
const transitions: Record<CodeJobStatus, readonly CodeJobStatus[]> = {
  queued: ["dispatched", "failed", "cancelled"],
  dispatched: ["running", "failed", "cancelled"],
  running: ["committing", "completed", "failed", "cancelled"],
  committing: ["completed", "failed"],
  completed: [],
  failed: [],
  cancelled: [],
};

export function canTransition(from: CodeJobStatus, to: CodeJobStatus) {
  return transitions[from].includes(to);
}

/** States that may move to `to`; used as the guard of conditional updates. */
export function statusesBefore(to: CodeJobStatus): CodeJobStatus[] {
  return CODE_JOB_STATUSES.filter((from) => canTransition(from, to));
}

export function isTerminal(status: CodeJobStatus) {
  return transitions[status].length === 0;
}

export const ACTIVE_CODE_JOB_STATUSES = CODE_JOB_STATUSES.filter(
  (status) => !isTerminal(status),
);

// Stable error codes stored on failed jobs and translated by the web app.
export const CODE_JOB_ERRORS = [
  "repository_unavailable",
  "workflow_missing",
  "app_permission",
  "dispatch_failed",
  "claim_timeout",
  "ci_run_failed",
  "timed_out",
  "access_revoked",
  "changeset_rejected",
  "branch_exists",
  "commit_failed",
  "agent_failed",
  "setup_failed",
  "no_model_key",
] as const;

export type CodeJobError = (typeof CODE_JOB_ERRORS)[number];

// Codes the job program may report through the fail callback.
export const JOB_REPORTED_ERRORS = [
  "agent_failed",
  "setup_failed",
  "no_model_key",
  "timed_out",
] as const satisfies readonly CodeJobError[];

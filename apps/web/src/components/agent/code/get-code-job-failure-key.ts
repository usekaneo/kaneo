// Stable failure codes stored on failed jobs (see the API's CODE_JOB_ERRORS).
const KNOWN_FAILURES: Record<string, string> = {
  repository_unavailable: "repositoryUnavailable",
  workflow_missing: "workflowMissing",
  app_permission: "appPermission",
  dispatch_failed: "dispatchFailed",
  claim_timeout: "claimTimeout",
  ci_run_failed: "ciRunFailed",
  timed_out: "timedOut",
  access_revoked: "accessRevoked",
  changeset_rejected: "changesetRejected",
  branch_exists: "branchExists",
  commit_failed: "commitFailed",
  agent_failed: "agentFailed",
  setup_failed: "setupFailed",
  no_model_key: "noModelKey",
};

export function getCodeJobFailureKey(error: string | null) {
  const key = error ? KNOWN_FAILURES[error] : undefined;
  return `agent:code.failure.${key ?? "generic"}`;
}

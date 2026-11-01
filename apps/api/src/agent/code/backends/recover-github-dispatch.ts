import { getAgentRepositoryAccess } from "../agent-github-app";
import type { CodeJob } from "../finish-job";

export class GithubDispatchPendingError extends Error {
  constructor() {
    super("GitHub dispatch outcome is pending reconciliation");
  }
}

export async function recoverGithubDispatch(
  job: CodeJob,
  signal: AbortSignal = AbortSignal.timeout(30000),
) {
  if (!job.workflowSha) return null;
  const { octokit } = await getAgentRepositoryAccess(job);
  // Explicit pages preserve the bounded request signal. The shared fetch
  // adapter returns a bounded Response without the URL metadata expected by
  // Octokit's generic pagination iterator.
  for (let page = 1; ; page++) {
    const { data } = await octokit.rest.actions.listWorkflowRuns({
      owner: job.repositoryOwner,
      repo: job.repositoryName,
      workflow_id: "kaneo-agent.yml",
      event: "workflow_dispatch",
      per_page: 100,
      page,
      created: `>=${job.createdAt.toISOString()}`,
      request: { signal, timeout: 10000 },
    });
    const run = data.workflow_runs.find(
      (item) =>
        item.display_title === `Kaneo job ${job.id}` &&
        item.head_sha === job.workflowSha,
    );
    if (run)
      return {
        externalRef: String(run.id),
        externalUrl: `https://github.com/${job.repositoryOwner}/${job.repositoryName}/actions/runs/${run.id}`,
      };
    if (data.workflow_runs.length < 100) return null;
  }
}

import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../../database";
import { z } from "zod";
import {
  getAgentRepositoryAccess,
  hasStatus,
  isStatus,
} from "../agent-github-app";
import {
  GithubDispatchPendingError,
  recoverGithubDispatch,
} from "./recover-github-dispatch";
import type { CodeJob } from "../finish-job";

export async function dispatchGithubJob(
  job: CodeJob,
  signal: AbortSignal = AbortSignal.timeout(30000),
) {
  const { octokit, repository } = await getAgentRepositoryAccess(job);
  const params = {
    owner: job.repositoryOwner,
    repo: job.repositoryName,
    request: { signal, timeout: 10000 },
  };
  // Dispatch only the reviewed workflow on the default branch, even when the
  // coding base is another branch. Repository text never chooses a workflow.
  const workflowRef = job.workflowRef ?? repository.default_branch;
  const { data: workflowBranch } = await octokit.rest.repos.getBranch({
    ...params,
    branch: workflowRef,
  });
  const { data: base } = await octokit.rest.repos.getBranch({
    ...params,
    branch: job.baseRef!,
  });
  // Freeze both commits before the non-transactional dispatch. A response lost
  // after dispatch must not silently change the job's base on recovery.
  const baseSha = job.baseSha ?? base.commit.sha;
  const workflowSha = job.workflowSha ?? workflowBranch.commit.sha;
  const [prepared] = await db
    .update(schema.agentJobTable)
    .set({ baseSha, workflowRef, workflowSha })
    .where(
      and(
        eq(schema.agentJobTable.id, job.id),
        eq(schema.agentJobTable.status, "queued"),
        eq(schema.agentJobTable.leaseOwner, job.leaseOwner!),
      ),
    )
    .returning({ id: schema.agentJobTable.id });
  if (!prepared) throw new HTTPException(409, { message: "dispatch_failed" });
  // A crash after dispatch must not blindly create a second run. The template
  // sets run-name to this unique value, and the first run alone may claim.
  const existing = await recoverGithubDispatch({ ...job, workflowSha }, signal);
  if (existing) return { ...existing, workflowRef, workflowSha, baseSha };
  if (job.dispatchAttemptedAt) throw new GithubDispatchPendingError();
  if (workflowBranch.commit.sha !== workflowSha)
    throw new HTTPException(409, { message: "dispatch_failed" });
  signal.throwIfAborted();
  const [marked] = await db
    .update(schema.agentJobTable)
    .set({ dispatchAttemptedAt: new Date() })
    .where(
      and(
        eq(schema.agentJobTable.id, job.id),
        eq(schema.agentJobTable.status, "queued"),
        eq(schema.agentJobTable.leaseOwner, job.leaseOwner!),
      ),
    )
    .returning({ id: schema.agentJobTable.id });
  if (!marked) throw new HTTPException(409, { message: "dispatch_failed" });
  if (signal.aborted) {
    // The request has not been sent yet; this cancellation is known to be free.
    await db
      .update(schema.agentJobTable)
      .set({ dispatchAttemptedAt: null })
      .where(
        and(
          eq(schema.agentJobTable.id, job.id),
          eq(schema.agentJobTable.leaseOwner, job.leaseOwner!),
        ),
      );
    signal.throwIfAborted();
  }
  const response = await (async () => {
    try {
      return await octokit.request(
        "POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
        {
          ...params,
          workflow_id: "kaneo-agent.yml",
          ref: workflowRef,
          inputs: { job: job.id },
          return_run_details: true,
          request: { timeout: 10000, signal, retries: 0 },
        },
      );
    } catch (error) {
      // Explicit rejections are safe to retry. A transport error or 5xx may
      // have accepted the launch: preserve the marker and only look it up.
      if (
        hasStatus(error) &&
        [400, 401, 403, 404, 422, 429].includes(error.status)
      ) {
        await db
          .update(schema.agentJobTable)
          .set({ dispatchAttemptedAt: null })
          .where(
            and(
              eq(schema.agentJobTable.id, job.id),
              eq(schema.agentJobTable.leaseOwner, job.leaseOwner!),
            ),
          );
        throw error;
      }
      throw new GithubDispatchPendingError();
    }
  })();
  const parsed = z
    .object({ workflow_run_id: z.number().int().positive() })
    .safeParse(response.data);
  if (!parsed.success) throw new GithubDispatchPendingError();
  const data = parsed.data;
  return {
    externalRef: String(data.workflow_run_id),
    externalUrl: `https://github.com/${params.owner}/${params.repo}/actions/runs/${data.workflow_run_id}`,
    workflowRef,
    workflowSha,
    baseSha,
  };
}

export async function cancelGithubJob(job: CodeJob) {
  if (!job.externalRef) return;
  const { octokit } = await getAgentRepositoryAccess(job);
  try {
    await octokit.rest.actions.cancelWorkflowRun({
      owner: job.repositoryOwner,
      repo: job.repositoryName,
      run_id: Number(job.externalRef),
    });
  } catch (error) {
    if (!isStatus(error, 409)) throw error;
  }
}

export async function observeGithubJob(job: CodeJob) {
  if (!job.externalRef) return "unknown";
  const { octokit } = await getAgentRepositoryAccess(job);
  const { data } = await octokit.rest.actions.getWorkflowRun({
    owner: job.repositoryOwner,
    repo: job.repositoryName,
    run_id: Number(job.externalRef),
  });
  return data.status === "completed" ? "gone" : "running";
}

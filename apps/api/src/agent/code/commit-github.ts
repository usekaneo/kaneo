import { gunzipSync } from "node:zlib";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { handlePullRequestOpened } from "../../plugins/github/webhooks/pull-request-opened";
import { codeRepository } from "./repository";
import { checkChangeset } from "./changeset-policy";
import { changesetSchema } from "./changeset-schema";
import { pullRequestTitle, taskKey } from "./branch-name";
import type { CodeJob } from "./finish-job";
import { isStatus } from "./agent-github-app";

export async function commitGithubChangeset(
  job: CodeJob,
  signal: AbortSignal = AbortSignal.timeout(120000),
) {
  if (!job.taskId || !job.integrationId || !job.baseSha || !job.baseRef)
    throw new HTTPException(403, { message: "access_revoked" });
  const { octokit, repository, task, config } = await codeRepository(
    {
      userId: job.userId,
      workspaceId: job.workspaceId,
      projectId: job.projectId,
    },
    job.taskId,
    job.integrationId,
    db,
    true,
  );
  if (
    repository.id !== job.repositoryId ||
    repository.owner.login !== job.repositoryOwner ||
    repository.name !== job.repositoryName
  )
    throw new HTTPException(403, { message: "access_revoked" });
  const stored = await db.query.agentJobChangesetTable.findFirst({
    where: eq(schema.agentJobChangesetTable.jobId, job.id),
  });
  if (!stored) throw new Error("Missing changeset");
  const changes = changesetSchema.parse(
    JSON.parse(
      gunzipSync(stored.data, { maxOutputLength: 16 * 1024 * 1024 }).toString(),
    ),
  );
  if (changes.outcome !== "changes") throw new Error("Invalid changeset");
  const checked = checkChangeset(changes, {
    baseSha: job.baseSha,
    branch: job.branch,
    protectedRefs: [repository.default_branch, job.baseRef],
  });
  if (!checked.ok)
    throw new HTTPException(400, { message: "changeset_rejected" });
  const params = {
    owner: job.repositoryOwner,
    repo: job.repositoryName,
    request: { signal, timeout: 10000 },
  };
  let commitSha = job.commitSha;
  if (!commitSha) {
    const { data: base } = await octokit.rest.git.getCommit({
      ...params,
      commit_sha: job.baseSha,
    });
    const tree = [];
    for (const file of checked.files) {
      signal.throwIfAborted();
      if (file.action === "delete")
        tree.push({
          path: file.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: null,
        });
      else {
        const { data: blob } = await octokit.rest.git.createBlob({
          ...params,
          content: file.bytes.toString("base64"),
          encoding: "base64",
        });
        tree.push({
          path: file.path,
          mode: file.mode,
          type: "blob" as const,
          sha: blob.sha,
        });
      }
    }
    const { data: newTree } = await octokit.rest.git.createTree({
      ...params,
      base_tree: base.tree.sha,
      tree,
    });
    // Stable identity/date makes this content-addressed step repeatable after a
    // worker crash, even if it died before persisting the returned commit SHA.
    const identity = {
      name: "Kaneo Agent",
      email: "agent@kaneo.app",
      date: job.createdAt.toISOString(),
    };
    const { data: commit } = await octokit.rest.git.createCommit({
      ...params,
      message: changes.commitMessage,
      tree: newTree.sha,
      parents: [job.baseSha],
      author: identity,
      committer: identity,
    });
    commitSha = commit.sha;
    await db
      .update(schema.agentJobTable)
      .set({ commitSha })
      .where(eq(schema.agentJobTable.id, job.id));
  }
  let existingSha: string | undefined;
  try {
    existingSha = (
      await octokit.rest.git.getRef({ ...params, ref: `heads/${job.branch}` })
    ).data.object.sha;
  } catch (error) {
    if (!isStatus(error, 404)) throw error;
  }
  if (existingSha && existingSha !== commitSha)
    throw new HTTPException(409, { message: "branch_exists" });
  if (!existingSha) {
    try {
      await octokit.rest.git.createRef({
        ...params,
        ref: `refs/heads/${job.branch}`,
        sha: commitSha,
      });
    } catch (error) {
      // A lost response or a concurrent retry is safe only for our exact commit.
      if (!isStatus(error, 422)) throw error;
      const ref = await octokit.rest.git.getRef({
        ...params,
        ref: `heads/${job.branch}`,
      });
      if (ref.data.object.sha !== commitSha)
        throw new HTTPException(409, { message: "branch_exists" });
    }
  }
  const project = await db.query.projectTable.findFirst({
    where: eq(schema.projectTable.id, job.projectId),
  });
  if (!project) throw new HTTPException(403, { message: "access_revoked" });
  const title = pullRequestTitle(
    taskKey(project.slug, task.number),
    changes.title,
  );
  const taskUrl = `${(process.env.KANEO_CLIENT_URL || "http://localhost:5173").replace(/\/$/, "")}/dashboard/workspace/${job.workspaceId}/project/${job.projectId}/task/${task.id}`;
  // Link only the approved task, even if model-generated text includes other
  // task URLs. The existing webhook resolver rejects ambiguous references.
  const body = `${changes.body.replace(/\/dashboard\/workspace\/[\w-]+\/project\/[\w-]+\/task\/[\w-]+/g, "[task reference removed]")}\n\nTask: ${taskUrl}\n\n${changes.summary ?? ""}\n\n<!-- kaneo-job:${job.id} -->`;
  const { data: pulls } = await octokit.rest.pulls.list({
    ...params,
    head: `${job.repositoryOwner}:${job.branch}`,
    state: "all",
    per_page: 100,
  });
  const existingPr = pulls.find(
    (pr) =>
      pr.head.sha === commitSha &&
      pr.base.ref === job.baseRef &&
      pr.body?.includes(`<!-- kaneo-job:${job.id} -->`),
  );
  if (!existingPr && pulls.length)
    throw new HTTPException(409, { message: "branch_exists" });
  const pr =
    existingPr ??
    (
      await octokit.rest.pulls.create({
        ...params,
        head: job.branch,
        base: job.baseRef,
        title,
        body,
        draft: true,
      })
    ).data;
  // Run the same domain path as the integration webhook. The Agent App does
  // not replace the ordinary integration's installation binding.
  await handlePullRequestOpened({
    action: "opened",
    installation: { id: config.installationId! },
    repository: {
      id: job.repositoryId,
      owner: { login: job.repositoryOwner },
      name: job.repositoryName,
    },
    pull_request: {
      number: pr.number,
      title: pr.title,
      body: pr.body,
      html_url: pr.html_url,
      state: pr.state,
      draft: pr.draft ?? true,
      merged: false,
      head: { ref: job.branch },
      user: pr.user ? { login: pr.user.login } : null,
    },
  });
  return {
    prNumber: pr.number,
    prUrl: `https://github.com/${job.repositoryOwner}/${job.repositoryName}/pull/${pr.number}`,
    summary: changes.summary ?? "",
    outcome: "pr_opened" as const,
  };
}

import { and, eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import { publishEvent } from "../../apps/api/src/events";
import db, { getDatabase, schema } from "../../apps/api/src/database";
import { handlePullRequestOpened } from "../../apps/api/src/plugins/github/webhooks/pull-request-opened";
import { handlePullRequestClosed } from "../../apps/api/src/plugins/github/webhooks/pull-request-closed";
import { handleGiteaPullRequestOpened } from "../../apps/api/src/plugins/gitea/webhooks/pull-request-opened";
import { handleGiteaPullRequestClosed } from "../../apps/api/src/plugins/gitea/webhooks/pull-request-closed";
import { handleGitlabMergeRequestOpened } from "../../apps/api/src/plugins/gitlab/webhooks/merge-request-opened";
import { handleGitlabMergeRequestClosed } from "../../apps/api/src/plugins/gitlab/webhooks/merge-request-closed";
import moveTask from "../../apps/api/src/task/controllers/move-task";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock("../../apps/api/src/events", () => ({
  publishEvent: vi.fn(async () => undefined),
}));
beforeEach(async () => {
  await resetTestDatabase();
  vi.mocked(publishEvent).mockReset();
});
const cases = ["github", "gitea", "gitlab"].flatMap((provider) =>
  ["opened", "merged"].flatMap((action) =>
    ["ordinary", "moved", "returned"].map((race) => ({
      provider,
      action,
      race,
      sameStatus: false,
      syncScope: "all",
    })),
  ),
);
cases.push(
  ...["github", "gitea", "gitlab"].flatMap((provider) =>
    ["opened", "merged", "closed"].map((action) => ({
      provider,
      action,
      race: "ordinary",
      sameStatus: action !== "closed",
      syncScope: "all",
    })),
  ),
);
cases.push(
  ...["github", "gitea", "gitlab"].flatMap((provider) =>
    ["opened", "merged", "closed"].flatMap((action) =>
      ["excluded", "paused"].map((syncScope) => ({
        provider,
        action,
        race: "ordinary",
        sameStatus: false,
        syncScope,
      })),
    ),
  ),
);
it.each(cases)(
  "$provider $action webhook respects task ownership ($race, $syncScope issue sync)",
  async ({ provider, action, race, sameStatus, syncScope }) => {
    const { user, workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
      slug: "KAN",
    });
    const { project: destination } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    await db
      .update(schema.projectTable)
      .set({ lastTaskNumber: 1 })
      .where(eq(schema.projectTable.id, project.id));
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        number: 1,
        title: "card",
        status: sameStatus
          ? action === "opened"
            ? "in-progress"
            : "done"
          : "to-do",
        position: 0,
      })
      .returning();
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: project.id,
        type: provider,
        config: JSON.stringify({
          baseUrl: "https://git.example",
          accessToken: "test-only",
          repositoryOwner: "owner",
          repositoryName: "repo",
          projectPath: "owner/repo",
          installationId: 10,
          repositoryId: 20,
          verifiedGithubAccountId: "123",
          verifiedByUserId: user.id,
          branchPattern: "{slug}-{number}",
          ...(syncScope === "excluded"
            ? {
                syncRules: {
                  outgoing: {
                    mode: "labels",
                    match: "any",
                    labels: ["missing"],
                  },
                  incoming: { mode: "all" },
                },
              }
            : {}),
          statusTransitions: { onPROpen: "in-progress", onPRMerge: "done" },
        }),
      })
      .returning();
    if (syncScope === "paused")
      await db.insert(schema.externalLinkTable).values({
        taskId: task.id,
        integrationId: integration.id,
        resourceType: "issue",
        externalId: "2",
        url: "https://git.example/owner/repo/issues/2",
        metadata: JSON.stringify({ syncFilterPaused: true }),
      });
    if (action !== "opened")
      await db.insert(schema.externalLinkTable).values({
        taskId: task.id,
        integrationId: integration.id,
        resourceType: "pull_request",
        externalId: "1",
        url: "https://git.example/owner/repo/pull/1",
        metadata: JSON.stringify({
          state: provider === "gitlab" ? "opened" : "open",
        }),
      });
    const request = {
      action: action === "opened" ? "opened" : "closed",
      installation: { id: 10 },
      repository: {
        id: 20,
        owner: { login: "owner" },
        name: "repo",
        html_url: "https://git.example/owner/repo",
      },
      pull_request: {
        number: 1,
        title: "change",
        body: null,
        html_url: "https://git.example/owner/repo/pull/1",
        state: action === "opened" ? "open" : "closed",
        draft: false,
        merged: action === "merged",
        merged_at: action === "merged" ? new Date().toISOString() : null,
        head: { ref: "KAN-1" },
        user: { login: "author" },
      },
    };
    const mergeRequest = {
      project: {
        id: 20,
        name: "repo",
        path_with_namespace: "owner/repo",
        web_url: "https://git.example/owner/repo",
      },
      object_attributes: {
        iid: 1,
        title: "change",
        description: null,
        url: "https://git.example/owner/repo/-/merge_requests/1",
        state:
          action === "opened"
            ? "opened"
            : action === "merged"
              ? "merged"
              : "closed",
        action:
          action === "opened"
            ? "open"
            : action === "merged"
              ? "merge"
              : "close",
        source_branch: "KAN-1",
        draft: false,
      },
    };
    vi.mocked(publishEvent).mockImplementation(async (type) => {
      if (type !== "task.updated") return;
      const committed = await db.query.externalLinkTable.findFirst({
        where: and(
          eq(schema.externalLinkTable.taskId, task.id),
          eq(schema.externalLinkTable.resourceType, "pull_request"),
        ),
      });
      expect(committed).toBeDefined();
      expect(JSON.parse(committed!.metadata!).state).toBe(
        action === "opened"
          ? provider === "gitlab"
            ? "opened"
            : "open"
          : action === "merged" && provider === "gitlab"
            ? "merged"
            : "closed",
      );
    });
    const transaction = getDatabase().transaction.bind(getDatabase());
    const intercepted =
      race === "ordinary"
        ? undefined
        : vi
            .spyOn(getDatabase(), "transaction")
            .mockImplementationOnce(async (apply, config) => {
              await moveTask({
                taskId: task.id,
                destinationProjectId: destination.id,
                userId: user.id,
              });
              if (race === "returned")
                await moveTask({
                  taskId: task.id,
                  destinationProjectId: project.id,
                  userId: user.id,
                });
              return transaction(apply, config);
            });
    try {
      if (provider === "github")
        await (
          action === "opened"
            ? handlePullRequestOpened
            : handlePullRequestClosed
        )(request);
      else if (provider === "gitea")
        await (
          action === "opened"
            ? handleGiteaPullRequestOpened
            : handleGiteaPullRequestClosed
        )(request, integration.id);
      else
        await (
          action === "opened"
            ? handleGitlabMergeRequestOpened
            : handleGitlabMergeRequestClosed
        )(mergeRequest, integration.id);
      const saved = await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      });
      expect(saved?.status).toBe(
        race === "ordinary"
          ? action === "opened"
            ? "in-progress"
            : action === "merged"
              ? "done"
              : "to-do"
          : "to-do",
      );
      expect(saved?.projectId).toBe(
        race === "moved" ? destination.id : project.id,
      );
      const links = await db.query.externalLinkTable.findMany({
        where: and(
          eq(schema.externalLinkTable.taskId, task.id),
          eq(schema.externalLinkTable.resourceType, "pull_request"),
        ),
      });
      expect(links).toHaveLength(race === "ordinary" ? 1 : 0);
      expect(
        vi
          .mocked(publishEvent)
          .mock.calls.filter(([type]) => type === "task.updated"),
      ).toEqual(
        race === "ordinary"
          ? [["task.updated", { projectId: project.id, taskId: task.id }]]
          : [],
      );
    } finally {
      intercepted?.mockRestore();
    }
  },
);

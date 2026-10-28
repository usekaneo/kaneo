import { and, eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { getDatabase, schema } from "../../apps/api/src/database";
import { publishEvent } from "../../apps/api/src/events";
import { handlePush } from "../../apps/api/src/plugins/github/webhooks/push";
import { handleGiteaPush } from "../../apps/api/src/plugins/gitea/webhooks/push";
import { handleGitlabPush } from "../../apps/api/src/plugins/gitlab/webhooks/push";
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
it.each(
  ["github", "gitea", "gitlab"].flatMap((provider) =>
    ["new", "existing", "moved", "excluded", "paused"].map((race) => ({
      provider,
      race,
    })),
  ),
)(
  "$provider branch push preserves ownership and final tasks ($race)",
  async ({ provider, race }) => {
    const { user, workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
      slug: "KAN",
    });
    const { project: destination } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        number: 1,
        title: "card",
        status: "done",
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
          ...(race === "excluded"
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
          statusTransitions: { onBranchPush: "in-progress" },
        }),
      })
      .returning();
    if (race === "paused")
      await db.insert(schema.externalLinkTable).values({
        taskId: task.id,
        integrationId: integration.id,
        resourceType: "issue",
        externalId: "2",
        url: "https://git.example/owner/repo/issues/2",
        metadata: JSON.stringify({ syncFilterPaused: true }),
      });
    if (race === "existing")
      await db.insert(schema.externalLinkTable).values({
        taskId: task.id,
        integrationId: integration.id,
        resourceType: "branch",
        externalId: "KAN-1",
        url: "https://git.example/owner/repo/tree/KAN-1",
      });
    const transaction = getDatabase().transaction.bind(getDatabase());
    const intercepted =
      race === "moved"
        ? vi
            .spyOn(getDatabase(), "transaction")
            .mockImplementationOnce(async (apply, config) => {
              await moveTask({
                taskId: task.id,
                destinationProjectId: destination.id,
                currentUserId: user.id,
              });
              return transaction(apply, config);
            })
        : undefined;
    const request = {
      ref: "refs/heads/KAN-1",
      after: "abc",
      installation: { id: 10 },
      repository: {
        id: 20,
        owner: { login: "owner" },
        name: "repo",
        html_url: "https://git.example/owner/repo",
      },
    };
    vi.mocked(publishEvent).mockImplementation(async (type) => {
      if (type !== "task.updated") return;
      const committed = await db.query.externalLinkTable.findFirst({
        where: and(
          eq(schema.externalLinkTable.taskId, task.id),
          eq(schema.externalLinkTable.resourceType, "branch"),
        ),
      });
      expect(committed?.resourceType).toBe("branch");
    });
    try {
      if (provider === "github") await handlePush(request);
      else if (provider === "gitea")
        await handleGiteaPush(request, integration.id);
      else
        await handleGitlabPush(
          {
            ref: request.ref,
            after: "abc",
            project: {
              id: 20,
              path_with_namespace: "owner/repo",
              web_url: "https://git.example/owner/repo",
            },
          },
          integration.id,
        );
      const saved = await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      });
      expect(saved?.projectId).toBe(
        race === "moved" ? destination.id : project.id,
      );
      expect(saved?.status).toBe(
        ["new", "excluded", "paused"].includes(race) ? "in-progress" : "done",
      );
      const links = await db.query.externalLinkTable.findMany({
        where: and(
          eq(schema.externalLinkTable.taskId, task.id),
          eq(schema.externalLinkTable.resourceType, "branch"),
        ),
      });
      expect(links).toHaveLength(race === "moved" ? 0 : 1);
      expect(
        vi
          .mocked(publishEvent)
          .mock.calls.filter(([type]) => type === "task.updated"),
      ).toHaveLength(race === "moved" ? 0 : 1);
    } finally {
      intercepted?.mockRestore();
    }
  },
);

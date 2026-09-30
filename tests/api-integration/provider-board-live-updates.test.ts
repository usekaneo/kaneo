import { beforeEach, expect, it, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import db, { schema } from "../../apps/api/src/database";
import { handleIssueEdited } from "../../apps/api/src/plugins/github/webhooks/issue-edited";
import { handleIssueLabeled } from "../../apps/api/src/plugins/github/webhooks/issue-labeled";
import { handleGiteaIssueEdited } from "../../apps/api/src/plugins/gitea/webhooks/issue-edited";
import { handleGiteaIssueLabeled } from "../../apps/api/src/plugins/gitea/webhooks/issue-labeled";
import { handleGitlabIssueUpdated } from "../../apps/api/src/plugins/gitlab/webhooks/issue-updated";
import { resetTestDatabase } from "./helpers/database";
import {
  createWorkspaceMember,
  createProjectFixture,
} from "./helpers/fixtures";
const m = vi.hoisted(() => ({
  integrations: [] as unknown[],
  publish: vi.fn(
    async (
      _name: string,
      _payload: { projectId: string; taskId: string },
    ) => {},
  ),
}));
vi.mock("../../apps/api/src/events", () => ({ publishEvent: m.publish }));
vi.mock(
  "../../apps/api/src/plugins/github/services/task-service",
  async (original) => ({
    ...(await original<
      typeof import("../../apps/api/src/plugins/github/services/task-service")
    >()),
    findAllIntegrationsByRepo: async () => m.integrations,
  }),
);
vi.mock(
  "../../apps/api/src/plugins/gitea/services/integration-lookup",
  async (original) => ({
    ...(await original<
      typeof import("../../apps/api/src/plugins/gitea/services/integration-lookup")
    >()),
    findAllIntegrationsByGiteaRepo: async () => m.integrations,
  }),
);
vi.mock(
  "../../apps/api/src/plugins/gitlab/services/integration-lookup",
  async (original) => ({
    ...(await original<
      typeof import("../../apps/api/src/plugins/gitlab/services/integration-lookup")
    >()),
    findAllIntegrationsByGitlabProject: async () => m.integrations,
  }),
);
beforeEach(async () => {
  await resetTestDatabase();
  m.publish.mockReset();
});
it.each([
  ["github", "text"],
  ["gitea", "text"],
  ["gitlab", "text"],
  ["github", "priority"],
  ["gitea", "priority"],
  ["gitlab", "priority"],
  ["github", "label"],
  ["gitea", "label"],
  ["gitlab", "label"],
  ["github", "label-delete"],
  ["gitea", "label-delete"],
  ["gitlab", "label-delete"],
])(
  "announces committed %s %s edits to observing boards",
  async (provider, kind) => {
    const { workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        number: 1,
        title: "Before",
        description: "Before body",
        priority: "low",
      })
      .returning();
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: project.id,
        type: provider,
        config: JSON.stringify({
          baseUrl: "https://gitea.example",
          repositoryOwner: "owner",
          repositoryName: "repo",
          accessToken: "fake-test-token",
        }),
        isActive: true,
      })
      .returning();
    m.integrations = [integration];
    await db.insert(schema.externalLinkTable).values({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "issue",
      externalId: "1",
      url: "https://provider.example/issues/1",
      metadata: "{}",
    });
    if (kind === "label-delete")
      await db.insert(schema.labelTable).values({
        taskId: task.id,
        workspaceId: workspace.id,
        name: "bug",
        color: "#ff0000",
      });
    m.publish.mockImplementation(async () => {
      const committed = await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      });
      if (kind === "text") {
        expect(committed?.title).toBe("After");
        expect(committed?.description).toBe("After body");
      } else if (kind === "priority") expect(committed?.priority).toBe("high");
      else {
        const labels = await db.query.labelTable.findMany({
          where: eq(schema.labelTable.taskId, task.id),
        });
        expect(labels.map((label) => label.name)).toEqual(
          kind === "label-delete" ? [] : ["bug"],
        );
      }
    });
    const issue = {
      number: 1,
      title: "After",
      body: "After body",
      html_url: "https://gitea.example/owner/repo/issues/1",
    };
    const repository = {
      id: 2,
      name: "repo",
      full_name: "owner/repo",
      owner: { login: "owner" },
      html_url: "https://gitea.example/owner/repo",
    };
    if (provider === "github" || provider === "gitea") {
      if (kind === "text") {
        const payload = {
          action: "edited",
          issue,
          repository,
          changes: { title: { from: "Before" }, body: { from: "Before body" } },
        };
        if (provider === "github") await handleIssueEdited(payload);
        else await handleGiteaIssueEdited(payload);
      } else {
        const label = {
          name: kind === "priority" ? "priority:high" : "bug",
          color: "ff0000",
        };
        const payload = {
          action: kind === "label-delete" ? "unlabeled" : "labeled",
          issue: { ...issue, labels: kind === "label-delete" ? [] : [label] },
          label,
          repository,
        };
        if (provider === "github") await handleIssueLabeled(payload);
        else await handleGiteaIssueLabeled(payload);
      }
    } else {
      const label = {
        title: kind === "priority" ? "priority:high" : "bug",
        color: "#ff0000",
      };
      await handleGitlabIssueUpdated({
        object_attributes: {
          iid: 1,
          title: "After",
          description: "After body",
          url: "https://gitlab.example/owner/repo/-/issues/1",
          action: "update",
        },
        changes:
          kind === "text"
            ? {
                title: { previous: "Before", current: "After" },
                description: { previous: "Before body", current: "After body" },
              }
            : {
                labels: {
                  previous: kind === "label-delete" ? [label] : [],
                  current: kind === "label-delete" ? [] : [label],
                },
              },
        project: {
          name: "repo",
          web_url: "https://gitlab.example/owner/repo",
          path_with_namespace: "owner/repo",
        },
      });
    }
    const saved = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    if (kind === "text") {
      expect(saved?.title).toBe("After");
      expect(saved?.description).toBe("After body");
    } else if (kind === "priority") expect(saved?.priority).toBe("high");
    else {
      const labels = await db.query.labelTable.findMany({
        where: eq(schema.labelTable.taskId, task.id),
      });
      expect(labels.map((label) => label.name)).toEqual(
        kind === "label-delete" ? [] : ["bug"],
      );
    }
    expect(m.publish.mock.calls).toEqual([
      [
        kind === "text" || (kind === "priority" && provider !== "gitlab")
          ? "task.updated"
          : "task.labels_updated",
        { projectId: project.id, taskId: task.id },
      ],
    ]);
  },
);

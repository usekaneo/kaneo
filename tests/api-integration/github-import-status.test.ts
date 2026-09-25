import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { importIssues } from "../../apps/api/src/github-integration/controllers/import-issues";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const m = vi.hoisted(() => ({ labels: [] as string[] }));
vi.mock("../../apps/api/src/plugins/github/utils/github-app", () => ({
  getVerifiedInstallationOctokit: async () => ({
    graphql: async (query: string) => ({
      repository: {
        databaseId: 2,
        ...(query.includes("query ImportIssues(")
          ? {
              issues: {
                totalCount: 1,
                pageInfo: { hasNextPage: false, endCursor: "issue-1" },
                nodes: [
                  {
                    number: 1,
                    title: "Imported",
                    body: "Description",
                    url: "https://github.com/example/repo/issues/1",
                    state: "OPEN",
                    createdAt: "2020-01-01T00:00:00Z",
                    author: null,
                    labels: {
                      totalCount: m.labels.length,
                      pageInfo: { hasNextPage: false, endCursor: null },
                      nodes: m.labels.map((name) => ({
                        name,
                        color: "ffffff",
                      })),
                    },
                    comments: {
                      totalCount: 0,
                      pageInfo: { hasNextPage: false, endCursor: null },
                      nodes: [],
                    },
                  },
                ],
              },
            }
          : {
              pullRequests: {
                totalCount: 0,
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [],
              },
            }),
      },
    }),
  }),
}));
beforeEach(async () => {
  await resetTestDatabase();
  m.labels = [];
});
async function setup() {
  const { user, workspace } = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: "github",
      isActive: true,
      config: JSON.stringify({
        repositoryOwner: "example",
        repositoryName: "repo",
        installationId: 1,
        repositoryId: 2,
        verifiedGithubAccountId: "3",
        verifiedByUserId: user.id,
      }),
    })
    .returning();
  return { project, columns, integration, workspace };
}
async function storedTask() {
  return db.query.taskTable.findFirst();
}

describe("GitHub import project workflow validation", () => {
  it("maps arbitrary external statuses to a real local column for new tasks", async () => {
    const { project, columns } = await setup();
    m.labels = ["status:hidden"];
    expect(await importIssues(project.id)).toMatchObject({ imported: 1 });
    expect(await storedTask()).toMatchObject({
      status: "to-do",
      columnId: columns.todo.id,
    });
  });

  it("preserves an existing valid status when reimport has an unknown label", async () => {
    const { project, columns } = await setup();
    m.labels = ["status:in-progress"];
    await importIssues(project.id);
    m.labels = ["status:hidden"];
    expect(await importIssues(project.id)).toMatchObject({ updated: 1 });
    expect(await storedTask()).toMatchObject({
      status: "in-progress",
      columnId: columns.inProgress.id,
    });
  });

  it("uses custom columns belonging to the imported project and updates columnId together", async () => {
    const { project, columns } = await setup();
    await db
      .update(schema.columnTable)
      .set({ slug: "ready", name: "Ready" })
      .where(eq(schema.columnTable.id, columns.todo.id));
    m.labels = ["status:hidden"];
    await importIssues(project.id);
    expect(await storedTask()).toMatchObject({
      status: "ready",
      columnId: columns.todo.id,
    });
    m.labels = ["status:in-review"];
    await importIssues(project.id);
    expect(await storedTask()).toMatchObject({
      status: "in-review",
      columnId: columns.inReview.id,
    });
  });

  it.each(["planned", "archived"])(
    "allows virtual status %s and clears the old column",
    async (status) => {
      const { project } = await setup();
      await importIssues(project.id);
      m.labels = [`status:${status}`];
      await importIssues(project.id);
      expect(await storedTask()).toMatchObject({ status, columnId: null });
    },
  );

  it("uses planned without workflow columns and repairs an invalid legacy status on reimport", async () => {
    const { project } = await setup();
    await db
      .delete(schema.columnTable)
      .where(eq(schema.columnTable.projectId, project.id));
    await importIssues(project.id);
    expect(await storedTask()).toMatchObject({
      status: "planned",
      columnId: null,
    });
    const task = await storedTask();
    if (!task) throw new Error("Expected imported task");
    await db
      .update(schema.taskTable)
      .set({ status: "hidden" })
      .where(eq(schema.taskTable.id, task.id));
    m.labels = ["status:hidden"];
    await importIssues(project.id);
    expect(await storedTask()).toMatchObject({
      status: "planned",
      columnId: null,
    });
  });

  it("does not mutate another project's task through a legacy external link", async () => {
    const { project, integration, workspace } = await setup();
    const { project: other } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({ projectId: other.id, title: "Untouched", number: 1 })
      .returning();
    await db.insert(schema.externalLinkTable).values({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "issue",
      externalId: "1",
      url: "https://github.com/example/repo/issues/1",
    });
    m.labels = ["status:archived"];
    expect(await importIssues(project.id)).toMatchObject({
      imported: 0,
      updated: 0,
      skipped: 1,
    });
    expect(await storedTask()).toMatchObject({
      title: "Untouched",
      status: "to-do",
    });
  });
});

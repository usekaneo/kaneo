import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { handleGitlabIssueUpdated } from "../../apps/api/src/plugins/gitlab/webhooks/issue-updated";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const mocks = vi.hoisted(() => ({
  listIssues: vi.fn(),
  listIssueNotes: vi.fn(async () => []),
  listMergeRequests: vi.fn(async () => []),
}));
vi.mock(
  "../../apps/api/src/plugins/gitlab/utils/gitlab-api",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../apps/api/src/plugins/gitlab/utils/gitlab-api")
    >()),
    createGitlabClient: () => mocks,
  }),
);
const remoteIssue = {
  id: 10,
  iid: 1,
  title: "Remote title",
  description: "Remote description",
  web_url: "https://gitlab.example/group/project/-/issues/1",
  state: "opened",
  labels: [],
};
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  mocks.listIssues.mockResolvedValue([remoteIssue]);
});
async function setup(actions: string[] = ["create", "update"]) {
  const member = await createWorkspaceMember({ role: "gitlab-importer" });
  await db.insert(schema.workspaceRoleTable).values({
    workspaceId: member.workspace.id,
    role: "gitlab-importer",
    permission: JSON.stringify({ task: actions }),
  });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: "gitlab",
      isActive: true,
      config: JSON.stringify({
        baseUrl: "https://gitlab.example",
        projectPath: "group/project",
        accessToken: "fake-test-token",
      }),
    })
    .returning();
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Local title",
      description: "Local description",
      number: 1,
    })
    .returning();
  await db.insert(schema.externalLinkTable).values({
    taskId: task.id,
    integrationId: integration.id,
    resourceType: "issue",
    externalId: "1",
    url: remoteIssue.web_url,
  });
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const request = () =>
    app.request("/api/gitlab-integration/import-issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id }),
    });
  return { ...member, project, task, integration, request };
}
describe("GitLab import authorization", () => {
  it.each([{ actions: ["create"] }, { actions: ["update"] }, { actions: [] }])(
    "rejects incomplete task permissions $actions before calling GitLab",
    async ({ actions }) => {
      const { task, request } = await setup(actions);
      const response = await request();
      expect(response.status).toBe(403);
      expect(mocks.listIssues).not.toHaveBeenCalled();
      expect(
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, task.id),
        }),
      ).toMatchObject({
        title: "Local title",
        description: "Local description",
      });
    },
  );
  it("allows a custom role with both permissions to refresh an existing task", async () => {
    const { task, request } = await setup();
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ updated: 1, imported: 0 });
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      }),
    ).toMatchObject({
      title: remoteIssue.title,
      description: remoteIssue.description,
    });
  });
});
const label = (title: string) => ({ title, color: "#123456" });
describe("GitLab label reconciliation", () => {
  it.each([
    {
      name: "remote removal and addition",
      previous: [label("removed")],
      current: [label("added")],
      expected: ["added", "local"],
    },
    {
      name: "removing the last remote label",
      previous: [label("removed")],
      current: [],
      expected: ["local"],
    },
    {
      name: "missing previous labels",
      previous: undefined,
      current: [label("added")],
      expected: ["added", "local", "removed"],
    },
    {
      name: "missing current labels",
      previous: [label("removed")],
      current: undefined,
      expected: ["local", "removed"],
    },
  ])(
    "preserves local labels when $name",
    async ({ previous, current, expected }) => {
      const { task, workspace, integration } = await setup();
      await db.insert(schema.labelTable).values(
        ["local", "removed"].map((name) => ({
          name,
          taskId: task.id,
          workspaceId: workspace.id,
          color: "#123456",
        })),
      );
      const payload = {
        object_attributes: {
          ...remoteIssue,
          url: remoteIssue.web_url,
          action: "update",
        },
        project: {
          name: "project",
          path_with_namespace: "group/project",
          web_url: "https://gitlab.example/group/project",
        },
        changes: { labels: { previous, current } },
      };
      await handleGitlabIssueUpdated(payload, integration.id);
      // Redelivery must preserve the same result.
      await handleGitlabIssueUpdated(payload, integration.id);
      const saved = await db.query.labelTable.findMany({
        where: eq(schema.labelTable.taskId, task.id),
      });
      expect(saved.map((row) => row.name).sort()).toEqual(expected);
    },
  );
});

describe("GitLab status label snapshots", () => {
  it.each([
    { statusLabel: "status:to-do", expected: "done" },
    { statusLabel: "status:in-progress", expected: "in-progress" },
  ])(
    "applies only changed status labels: $statusLabel → $expected",
    async ({ statusLabel, expected }) => {
      const { task, integration } = await setup();
      await db
        .update(schema.taskTable)
        .set({ status: "done" })
        .where(eq(schema.taskTable.id, task.id));
      await handleGitlabIssueUpdated(
        {
          object_attributes: {
            ...remoteIssue,
            url: remoteIssue.web_url,
            action: "update",
          },
          project: {
            name: "project",
            path_with_namespace: "group/project",
            web_url: "https://gitlab.example/group/project",
          },
          changes: {
            labels: {
              previous: [label("status:to-do")],
              current: [label(statusLabel), label("bug")],
            },
          },
        },
        integration.id,
      );
      expect(
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, task.id),
        }),
      ).toMatchObject({ status: expected });
    },
  );
});

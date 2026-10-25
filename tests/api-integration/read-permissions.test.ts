import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type Permissions = Record<string, string[]>;
type Authentication = "api-key" | "custom-role";

beforeEach(resetTestDatabase);

async function fixture(
  authentication: Authentication,
  permissions: Permissions,
) {
  const member = await createWorkspaceMember({
    role: authentication === "custom-role" ? "limited" : "admin",
  });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Private task",
      description: "Private description",
      number: 1,
      status: "to-do",
    })
    .returning();
  const [label] = await db
    .insert(schema.labelTable)
    .values({
      workspaceId: member.workspace.id,
      taskId: task.id,
      name: "Private label",
      color: "red",
    })
    .returning();
  const [timeEntry] = await db
    .insert(schema.timeEntryTable)
    .values({
      taskId: task.id,
      userId: member.user.id,
      description: "Private time entry",
      startTime: new Date(),
    })
    .returning();
  const [comment] = await db
    .insert(schema.activityTable)
    .values({
      taskId: task.id,
      type: "comment",
      userId: member.user.id,
      content: "Private comment",
    })
    .returning();
  const headers: Record<string, string> = {};
  if (authentication === "custom-role") {
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: member.workspace.id,
      role: "limited",
      permission: JSON.stringify(permissions),
    });
    mockAuthenticatedSession(member.user);
  } else {
    mockAnonymousSession();
    const key = `test_${randomUUID()}`;
    await db.insert(schema.apikeyTable).values({
      referenceId: member.user.id,
      userId: member.user.id,
      key: createHash("sha256").update(key).digest("base64url"),
      permissions: JSON.stringify(permissions),
      enabled: true,
      // This matrix exercises authorization across more than ten routes.
      rateLimitEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    headers["x-api-key"] = key;
  }
  const { app } = createApp();
  const workspaceId = member.workspace.id;
  const reads = [
    { path: `/api/task/${task.id}`, resources: ["task"] },
    { path: `/api/task/${task.id}/description`, resources: ["task"] },
    {
      path: `/api/task/description-matches/${project.id}?query=Private`,
      resources: ["task"],
    },
    { path: `/api/task/tasks/${project.id}`, resources: ["project", "task"] },
    { path: `/api/task/export/${project.id}`, resources: ["project", "task"] },
    { path: `/api/project/${project.id}`, resources: ["project"] },
    { path: `/api/project?workspaceId=${workspaceId}`, resources: ["project"] },
    {
      path: `/api/project/${project.id}/background`,
      resources: ["project"],
      allowedStatus: 404,
    },
    { path: `/api/column/${project.id}`, resources: ["project"] },
    { path: `/api/workflow-rule/${project.id}`, resources: ["project"] },
    { path: `/api/activity/${task.id}`, resources: ["task"] },
    { path: `/api/comment/${task.id}`, resources: ["task"] },
    { path: `/api/time-entry/task/${task.id}`, resources: ["task"] },
    { path: `/api/time-entry/${timeEntry.id}`, resources: ["task"] },
    { path: `/api/external-link/task/${task.id}`, resources: ["task"] },
    { path: `/api/task-relation/${task.id}`, resources: ["task"] },
    { path: `/api/label/task/${task.id}`, resources: ["label"] },
    { path: `/api/label/workspace/${workspaceId}`, resources: ["label"] },
    { path: `/api/label/${label.id}`, resources: ["label"] },
    { path: `/api/workspace/${workspaceId}/members`, resources: ["workspace"] },
    ...[
      "github",
      "gitea",
      "gitlab",
      "discord",
      "generic-webhook",
      "mattermost",
      "slack",
      "telegram",
    ].map((provider) => ({
      path: `/api/${provider}-integration/project/${project.id}`,
      resources: ["project"],
    })),
    ...["tasks", "comments", "activities", "projects", "workspaces", "all"].map(
      (type) => ({
        path: `/api/search?workspaceId=${workspaceId}&q=Private&type=${type}`,
        resources:
          type === "projects"
            ? ["project"]
            : type === "workspaces"
              ? ["workspace"]
              : type === "all"
                ? ["project", "task", "workspace"]
                : ["project", "task"],
      }),
    ),
  ];
  return { app, member, comment, headers, reads };
}

describe("workspace read permissions", () => {
  for (const authentication of ["api-key", "custom-role"] as const) {
    it.each<Permissions>([
      {},
      { label: ["read"] },
      { project: ["read"] },
      { task: ["read"] },
      { workspace: ["read"] },
      {
        project: ["read"],
        task: ["read"],
        label: ["read"],
        workspace: ["read"],
      },
    ])(`${authentication} enforces read grants %j`, async (permissions) => {
      const { app, headers, reads, member } = await fixture(
        authentication,
        permissions,
      );
      for (const { path, resources, ...options } of reads) {
        const allowed = resources.every((resource) =>
          permissions[resource]?.includes("read"),
        );
        const response = await app.request(path, { headers });
        expect(response.status, path).toBe(
          allowed ? (options.allowedStatus ?? 200) : 403,
        );
        if (!allowed) {
          const body = await response.json();
          expect(body.code, path).toBe(
            authentication === "api-key"
              ? "API_KEY_SCOPE"
              : "MISSING_PERMISSION",
          );
        }
      }
      for (const suffix of ["capabilities", "project-access/me"]) {
        expect(
          (
            await app.request(
              `/api/workspace/${member.workspace.id}/${suffix}`,
              { headers },
            )
          ).status,
        ).toBe(200);
      }
    });

    it(`${authentication} cannot edit or delete its own comment without task:update through activity aliases`, async () => {
      const { app, headers, comment } = await fixture(authentication, {
        task: ["read"],
      });
      for (const method of ["PUT", "DELETE"]) {
        const response = await app.request("/api/activity/comment", {
          method,
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({ activityId: comment.id, comment: "Changed" }),
        });
        expect(response.status).toBe(403);
      }
      expect(
        await db.query.activityTable.findFirst({
          where: eq(schema.activityTable.id, comment.id),
        }),
      ).toMatchObject({ content: "Private comment" });
    });
  }

  it("limits workspace search results to the workspace whose permissions were checked", async () => {
    const { app, member, headers } = await fixture("custom-role", {
      workspace: ["read"],
    });
    const other = await createWorkspaceMember({
      workspaceName: "Private other workspace",
    });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: other.workspace.id,
      userId: member.user.id,
      role: "no-read",
      joinedAt: new Date(),
    });
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: other.workspace.id,
      role: "no-read",
      permission: "{}",
    });
    const response = await app.request(
      `/api/search?workspaceId=${member.workspace.id}&q=Private&type=workspaces`,
      { headers },
    );
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain(other.workspace.id);
  });
});

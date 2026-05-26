import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type CreateTaskBody = {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  status: string;
};

async function seedTask(projectId: string, columnId: string | null) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      title: "Seeded task",
      description: "Existing",
      priority: "medium",
      status: "to-do",
      columnId,
      number: 1,
      position: 1,
    })
    .returning();
  return task;
}

async function createWorkspaceRoleRow(
  workspaceId: string,
  role: string,
  permission: Record<string, string[]> | string,
) {
  await db.insert(schema.workspaceRoleTable).values({
    workspaceId,
    role,
    permission:
      typeof permission === "string" ? permission : JSON.stringify(permission),
  });
}

async function postCreateTask(
  app: ReturnType<typeof createApp>["app"],
  projectId: string,
  body: Partial<CreateTaskBody> = {},
) {
  return app.request(`/api/task/${projectId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "RBAC probe",
      description: "",
      priority: "low",
      status: "to-do",
      ...body,
    }),
  });
}

describe("API integration: workspace RBAC enforcement", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("built-in roles", () => {
    it("allows a member to create a task (member role grants task:create)", async () => {
      const member = await createWorkspaceMember({ role: "member" });
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await postCreateTask(app, project.id);
      expect(response.status).toBe(200);
    });

    it("blocks a viewer from creating a task (viewer role lacks task:create)", async () => {
      const member = await createWorkspaceMember({ role: "viewer" });
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await postCreateTask(app, project.id);
      expect(response.status).toBe(403);
      await expect(response.text()).resolves.toBe("Insufficient permissions");

      const persisted = await db.query.taskTable.findFirst({
        where: and(
          eq(schema.taskTable.projectId, project.id),
          eq(schema.taskTable.title, "RBAC probe"),
        ),
      });
      expect(persisted).toBeUndefined();
    });

    it("blocks a member from deleting a task (member role lacks task:delete)", async () => {
      const member = await createWorkspaceMember({ role: "member" });
      const { project, columns } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      const task = await seedTask(project.id, columns.todo.id);

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request(`/api/task/${task.id}`, {
        method: "DELETE",
      });
      expect(response.status).toBe(403);

      const stillThere = await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      });
      expect(stillThere).toBeDefined();
    });

    it("allows an admin to delete a task (admin role grants task:delete)", async () => {
      const member = await createWorkspaceMember({ role: "admin" });
      const { project, columns } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      const task = await seedTask(project.id, columns.todo.id);

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request(`/api/task/${task.id}`, {
        method: "DELETE",
      });
      expect(response.status).toBe(200);

      const gone = await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      });
      expect(gone).toBeUndefined();
    });

    it("allows an owner to delete a task (owner role grants task:delete)", async () => {
      const member = await createWorkspaceMember({ role: "owner" });
      const { project, columns } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      const task = await seedTask(project.id, columns.todo.id);

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request(`/api/task/${task.id}`, {
        method: "DELETE",
      });
      expect(response.status).toBe(200);
    });

    it("returns 403 when the user has no row in workspace_member for the workspace", async () => {
      const member = await createWorkspaceMember({ role: "admin" });
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });

      const outsiderId = `user-${randomUUID()}`;
      const [outsider] = await db
        .insert(schema.userTable)
        .values({
          id: outsiderId,
          email: `${outsiderId}@example.com`,
          emailVerified: true,
          name: "Outsider",
        })
        .returning();

      mockAuthenticatedSession(outsider);
      const { app } = createApp();

      const response = await postCreateTask(app, project.id);
      // workspaceAccess.fromProject runs first and rejects with its own message
      expect(response.status).toBe(403);
    });
  });

  describe("custom workspace roles", () => {
    it("blocks a custom role that only grants task:read from creating a task", async () => {
      const member = await createWorkspaceMember({ role: "readonly" });
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      await createWorkspaceRoleRow(member.workspace.id, "readonly", {
        task: ["read"],
        project: ["read"],
      });

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await postCreateTask(app, project.id);
      expect(response.status).toBe(403);
    });

    it("allows a custom role that grants task:create to create a task", async () => {
      const member = await createWorkspaceMember({ role: "creator" });
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      await createWorkspaceRoleRow(member.workspace.id, "creator", {
        task: ["create", "read"],
        project: ["read"],
      });

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await postCreateTask(app, project.id);
      expect(response.status).toBe(200);
    });

    it("lets a workspace_role row override the built-in viewer permissions", async () => {
      // viewer's compiled-in statements have no task:create. A workspace_role
      // row for "viewer" with task:create should override and grant access.
      const member = await createWorkspaceMember({ role: "viewer" });
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      await createWorkspaceRoleRow(member.workspace.id, "viewer", {
        task: ["create", "read", "update"],
        project: ["read"],
        workspace: ["read"],
      });

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await postCreateTask(app, project.id);
      expect(response.status).toBe(200);
    });

    it("returns 403 when the workspace_role permission JSON is malformed", async () => {
      const member = await createWorkspaceMember({ role: "broken" });
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      // Malformed permission payload. The middleware should refuse rather than
      // crash; with no built-in fallback for "broken", access is denied.
      await createWorkspaceRoleRow(member.workspace.id, "broken", "not-json");

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await postCreateTask(app, project.id);
      expect(response.status).toBe(403);
    });

    it("drops malformed permission entries instead of throwing", async () => {
      const member = await createWorkspaceMember({ role: "partial" });
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      // Some entries are valid string arrays, others are objects/strings/etc.
      // Middleware keeps the valid ones and ignores the rest.
      await createWorkspaceRoleRow(
        member.workspace.id,
        "partial",
        JSON.stringify({
          task: ["create"],
          project: "not-an-array",
          weird: { nested: true },
        }),
      );

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await postCreateTask(app, project.id);
      expect(response.status).toBe(200);
    });

    it("falls back to built-in role when no workspace_role row exists for the name", async () => {
      // No workspace_role row, role is the compiled-in "admin" — should work.
      const member = await createWorkspaceMember({ role: "admin" });
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await postCreateTask(app, project.id);
      expect(response.status).toBe(200);
    });
  });

  describe("resource coverage: task:update", () => {
    it("allows a member to update a task", async () => {
      const member = await createWorkspaceMember({ role: "member" });
      const { project, columns } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      const task = await seedTask(project.id, columns.todo.id);

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request(`/api/task/${task.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Updated by member",
          description: "edit",
          priority: "high",
          status: "to-do",
          projectId: project.id,
          position: 1,
        }),
      });
      expect(response.status).toBe(200);
    });

    it("blocks a viewer from updating a task", async () => {
      const member = await createWorkspaceMember({ role: "viewer" });
      const { project, columns } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      const task = await seedTask(project.id, columns.todo.id);

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request(`/api/task/${task.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Viewer attempt",
          description: "nope",
          priority: "low",
          status: "to-do",
          projectId: project.id,
          position: 1,
        }),
      });
      expect(response.status).toBe(403);
    });
  });

  describe("resource coverage: task:assign", () => {
    it("blocks a member from assigning a task (assign is admin-tier)", async () => {
      const member = await createWorkspaceMember({ role: "member" });
      const { project, columns } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      const task = await seedTask(project.id, columns.todo.id);

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request(`/api/task/assignee/${task.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: member.user.id }),
      });
      expect(response.status).toBe(403);
    });

    it("allows an admin to assign a task", async () => {
      const member = await createWorkspaceMember({ role: "admin" });
      const { project, columns } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      const task = await seedTask(project.id, columns.todo.id);

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request(`/api/task/assignee/${task.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: member.user.id }),
      });
      expect(response.status).toBe(200);
    });
  });

  describe("resource coverage: project:create / update / delete", () => {
    it("allows a member to create a project", async () => {
      const member = await createWorkspaceMember({ role: "member" });
      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request("/api/project", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Member-made",
          workspaceId: member.workspace.id,
          slug: "MEM",
          icon: "Folder",
        }),
      });
      expect(response.status).toBe(200);
    });

    it("blocks a viewer from creating a project", async () => {
      const member = await createWorkspaceMember({ role: "viewer" });
      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request("/api/project", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Viewer attempt",
          workspaceId: member.workspace.id,
          slug: "VWR",
          icon: "Folder",
        }),
      });
      expect(response.status).toBe(403);
    });

    it("blocks a member from updating a project (project:update is admin-tier)", async () => {
      const member = await createWorkspaceMember({ role: "member" });
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request(`/api/project/${project.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Member-rename",
          icon: "Folder",
          slug: project.slug,
          description: "",
          isPublic: false,
        }),
      });
      expect(response.status).toBe(403);
    });

    it("allows an admin to update a project", async () => {
      const member = await createWorkspaceMember({ role: "admin" });
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request(`/api/project/${project.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Admin-rename",
          icon: "Folder",
          slug: project.slug,
          description: "",
          isPublic: false,
        }),
      });
      expect(response.status).toBe(200);
    });

    it("blocks a member from deleting a project (project:delete is admin-tier)", async () => {
      const member = await createWorkspaceMember({ role: "member" });
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request(`/api/project/${project.id}`, {
        method: "DELETE",
      });
      expect(response.status).toBe(403);
    });

    it("allows an admin to delete a project", async () => {
      const member = await createWorkspaceMember({ role: "admin" });
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request(`/api/project/${project.id}`, {
        method: "DELETE",
      });
      expect(response.status).toBe(200);
    });
  });

  describe("resource coverage: label:create / delete", () => {
    it("allows a member to create a label", async () => {
      const member = await createWorkspaceMember({ role: "member" });
      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request("/api/label", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "bug",
          color: "#ff0000",
          workspaceId: member.workspace.id,
        }),
      });
      expect(response.status).toBe(200);
    });

    it("blocks a viewer from creating a label", async () => {
      const member = await createWorkspaceMember({ role: "viewer" });
      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request("/api/label", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "nope",
          color: "#000000",
          workspaceId: member.workspace.id,
        }),
      });
      expect(response.status).toBe(403);
    });

    it("allows a member to delete a label", async () => {
      const member = await createWorkspaceMember({ role: "member" });
      const { project, columns } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      const task = await seedTask(project.id, columns.todo.id);
      // deleteLabel requires the label to be attached to a task; without a
      // taskId the controller rejects with 400 before checking permissions.
      const [label] = await db
        .insert(schema.labelTable)
        .values({
          name: "scratch",
          color: "#abcdef",
          workspaceId: member.workspace.id,
          taskId: task.id,
        })
        .returning();

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request(`/api/label/${label.id}`, {
        method: "DELETE",
      });
      expect(response.status).toBe(200);
    });

    it("blocks a viewer from deleting a label", async () => {
      const member = await createWorkspaceMember({ role: "viewer" });
      const { project, columns } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      const task = await seedTask(project.id, columns.todo.id);
      const [label] = await db
        .insert(schema.labelTable)
        .values({
          name: "scratch",
          color: "#abcdef",
          workspaceId: member.workspace.id,
          taskId: task.id,
        })
        .returning();

      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request(`/api/label/${label.id}`, {
        method: "DELETE",
      });
      expect(response.status).toBe(403);
    });
  });

  describe("resource coverage: workspace:manage_settings", () => {
    // The integration endpoints (slack/discord/etc.) all gate on
    // workspace:manage_settings. Use Slack as the canonical surface — the
    // 403 fires in middleware before the handler ever tries to call out.
    it("blocks a member from creating a Slack integration", async () => {
      const member = await createWorkspaceMember({ role: "member" });
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request(
        `/api/slack-integration/project/${project.id}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            webhookUrl: "https://hooks.slack.com/services/x/y/z",
          }),
        },
      );
      expect(response.status).toBe(403);
    });

    it("blocks a viewer from creating a Slack integration", async () => {
      const member = await createWorkspaceMember({ role: "viewer" });
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request(
        `/api/slack-integration/project/${project.id}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            webhookUrl: "https://hooks.slack.com/services/x/y/z",
          }),
        },
      );
      expect(response.status).toBe(403);
    });

    it("blocks a member from deleting an integration", async () => {
      const member = await createWorkspaceMember({ role: "member" });
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      mockAuthenticatedSession(member.user);
      const { app } = createApp();

      const response = await app.request(
        `/api/slack-integration/project/${project.id}`,
        { method: "DELETE" },
      );
      expect(response.status).toBe(403);
    });
  });

  describe("instance admin bypass", () => {
    it("bypasses the workspace permission check when user.role === 'admin'", async () => {
      const member = await createWorkspaceMember({ role: "viewer" });
      // Promote the user to instance admin
      await db
        .update(schema.userTable)
        .set({ role: "admin" })
        .where(eq(schema.userTable.id, member.user.id));

      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });

      // Reload the user so the mocked session reflects the admin role.
      const refreshedUser = await db.query.userTable.findFirst({
        where: eq(schema.userTable.id, member.user.id),
      });
      if (!refreshedUser) throw new Error("user vanished after update");

      mockAuthenticatedSession(refreshedUser);
      const { app } = createApp();

      const response = await postCreateTask(app, project.id);
      expect(response.status).toBe(200);
    });

    it("does not bypass for users with no role set", async () => {
      const member = await createWorkspaceMember({ role: "viewer" });
      // Explicitly null role on the user table — should NOT bypass.
      await db
        .update(schema.userTable)
        .set({ role: null })
        .where(eq(schema.userTable.id, member.user.id));

      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });

      mockAuthenticatedSession({ ...member.user, role: null });
      const { app } = createApp();

      const response = await postCreateTask(app, project.id);
      expect(response.status).toBe(403);
    });
  });
});

import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
});

describe("github integration routes are workspace scoped", () => {
  it("refuses to list repositories for a member without manage_settings", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "member" });
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request(
      `/api/github-integration/repositories/${project.id}`,
    );

    expect(response.status).toBe(403);
  });

  it("refuses to verify an installation for a member without manage_settings", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "member" });
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/github-integration/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        repositoryOwner: "usekaneo",
        repositoryName: "kaneo",
      }),
    });

    expect(response.status).toBe(403);
  });

  it("refuses to list repositories for a project in another workspace", async () => {
    const outsider = await createWorkspaceMember({ role: "owner" });
    const other = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: other.workspace.id,
    });

    mockAuthenticatedSession(outsider.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/github-integration/repositories/${project.id}`,
    );

    expect(response.status).toBe(403);
  });
});

describe("public project route", () => {
  it("refuses a project that is not public", async () => {
    const { workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });

    const { app } = createApp();
    const response = await app.request(`/api/public-project/${project.id}`);

    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain(project.name);
  });
});

describe("task assignees stay inside the workspace", () => {
  it("refuses to create a task assigned to a non-member", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const outsider = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Cross-workspace assignment",
        description: "",
        priority: "low",
        status: "to-do",
        userId: outsider.user.id,
      }),
    });

    expect(response.status).toBe(403);
  });

  it("refuses to reassign an existing task to a non-member", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const outsider = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: workspace.id,
    });

    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Seeded",
        description: "",
        priority: "low",
        status: "to-do",
        columnId: columns.todo?.id ?? null,
        number: 1,
        position: 1,
      })
      .returning();

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request(`/api/task/assignee/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: outsider.user.id }),
    });

    expect(response.status).toBe(403);
  });
});

describe("activity attribution", () => {
  it("credits the session user, not a userId supplied in the body", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const impersonated = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: workspace.id,
    });

    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Seeded",
        description: "",
        priority: "low",
        status: "to-do",
        columnId: columns.todo?.id ?? null,
        number: 1,
        position: 1,
      })
      .returning();

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/activity/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        userId: impersonated.user.id,
        message: `note-${randomUUID()}`,
        type: "created",
      }),
    });

    expect(response.status).toBe(200);
    const activity = await response.json();
    expect(activity.userId).toBe(user.id);
    expect(activity.userId).not.toBe(impersonated.user.id);
  });
});

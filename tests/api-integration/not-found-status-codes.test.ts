import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { mockAuthenticatedSession } from "./helpers/auth";
import { readErrorBody } from "./helpers/error-body";
import { createInstanceAdmin } from "./helpers/admin/create-instance-admin";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { createTaskFixture } from "./helpers/project-access/create-task-fixture";
import { projectAccessApi } from "./helpers/project-access/project-access-api";

beforeEach(resetTestDatabase);

async function snapshot(response: Response) {
  return { status: response.status, body: await response.text() };
}

async function workspaceWithTask(role = "owner") {
  const member = await createWorkspaceMember({ role });
  const project = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const task = await createTaskFixture(project, "Seeded", member.user.id);
  return { ...member, project: project.project, task };
}

describe("missing and deleted resources return 404", () => {
  it("returns 404 for a project that never existed", async () => {
    const own = await workspaceWithTask();
    mockAuthenticatedSession(own.user);

    const response = await projectAccessApi()(`/project/${randomUUID()}`);

    expect(response.status).toBe(404);
    expect(await readErrorBody(response)).toMatchObject({
      message: "Project not found",
      code: "NOT_FOUND",
    });
  });

  it("returns 404 for a deleted project", async () => {
    const own = await workspaceWithTask();
    mockAuthenticatedSession(own.user);
    const request = projectAccessApi();

    const created = await request("/project", {
      method: "POST",
      body: {
        workspaceId: own.workspace.id,
        name: "Short lived",
        icon: "Folder",
        slug: "short-lived",
      },
    });
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: string };

    expect((await request(`/project/${id}`, { method: "DELETE" })).status).toBe(
      200,
    );

    const response = await request(`/project/${id}`);
    expect(response.status).toBe(404);
    expect(await readErrorBody(response)).toMatchObject({
      message: "Project not found",
      code: "NOT_FOUND",
    });
  });

  it("returns 404 for a task that never existed", async () => {
    const own = await workspaceWithTask();
    mockAuthenticatedSession(own.user);

    const response = await projectAccessApi()(`/task/${randomUUID()}`);

    expect(response.status).toBe(404);
    expect(await readErrorBody(response)).toMatchObject({
      message: "Task not found",
      code: "NOT_FOUND",
    });
  });

  it("returns 404 for a deleted task", async () => {
    const own = await workspaceWithTask();
    mockAuthenticatedSession(own.user);
    const request = projectAccessApi();

    expect(
      (await request(`/task/${own.task.id}`, { method: "DELETE" })).status,
    ).toBe(200);

    const response = await request(`/task/${own.task.id}`);
    expect(response.status).toBe(404);
    expect(await readErrorBody(response)).toMatchObject({
      message: "Task not found",
      code: "NOT_FOUND",
    });
  });

  it("does not fall back to a workspace query when the task lookup fails", async () => {
    const own = await workspaceWithTask();
    mockAuthenticatedSession(own.user);

    const response = await projectAccessApi()(
      `/task/${randomUUID()}?workspaceId=${own.workspace.id}`,
    );

    expect(response.status).toBe(404);
    expect(await readErrorBody(response)).toMatchObject({
      message: "Task not found",
      code: "NOT_FOUND",
    });
  });

  it("returns 404 for a workspace that does not exist", async () => {
    const own = await workspaceWithTask();
    mockAuthenticatedSession(own.user);

    const response = await projectAccessApi()(
      `/project?workspaceId=workspace-${randomUUID()}`,
    );

    expect(response.status).toBe(404);
    expect(await readErrorBody(response)).toMatchObject({
      message: "Workspace not found",
      code: "NOT_FOUND",
    });
  });

  it("keeps 400 when no workspace id is given at all", async () => {
    const own = await workspaceWithTask();
    mockAuthenticatedSession(own.user);

    const response = await projectAccessApi()("/project");

    expect(response.status).toBe(400);
    expect(await readErrorBody(response)).toMatchObject({
      message: "Workspace ID could not be determined",
      code: "BAD_REQUEST",
    });
  });
});

describe("resources in another workspace look missing", () => {
  it("answers a foreign project exactly like a missing one", async () => {
    const own = await workspaceWithTask();
    const foreign = await workspaceWithTask();
    mockAuthenticatedSession(own.user);
    const request = projectAccessApi();

    const hidden = await snapshot(
      await request(`/project/${foreign.project.id}`),
    );
    const missing = await snapshot(await request(`/project/${randomUUID()}`));

    expect(hidden).toEqual(missing);
    expect(hidden.status).toBe(404);
    expect(hidden.body).not.toContain(foreign.project.name);
  });

  it("answers a foreign task exactly like a missing one", async () => {
    const own = await workspaceWithTask();
    const foreign = await workspaceWithTask();
    mockAuthenticatedSession(own.user);
    const request = projectAccessApi();

    const hidden = await snapshot(await request(`/task/${foreign.task.id}`));
    const missing = await snapshot(await request(`/task/${randomUUID()}`));

    expect(hidden).toEqual(missing);
    expect(hidden.status).toBe(404);
  });

  it("answers a foreign task mutation exactly like a missing one", async () => {
    const own = await workspaceWithTask();
    const foreign = await workspaceWithTask();
    mockAuthenticatedSession(own.user);
    const request = projectAccessApi();
    const body = { title: "Renamed" };

    const hidden = await snapshot(
      await request(`/task/title/${foreign.task.id}`, { method: "PUT", body }),
    );
    const missing = await snapshot(
      await request(`/task/title/${randomUUID()}`, { method: "PUT", body }),
    );

    expect(hidden).toEqual(missing);
    expect(hidden.status).toBe(404);
  });

  it("answers a foreign workspace exactly like a missing one", async () => {
    const own = await workspaceWithTask();
    const foreign = await workspaceWithTask();
    mockAuthenticatedSession(own.user);
    const request = projectAccessApi();

    const hidden = await snapshot(
      await request(`/project?workspaceId=${foreign.workspace.id}`),
    );
    const missing = await snapshot(
      await request(`/project?workspaceId=workspace-${randomUUID()}`),
    );

    expect(hidden).toEqual(missing);
    expect(hidden.status).toBe(404);
  });
});

describe("members without a permission still get 403", () => {
  it("refuses to delete a project for the built-in member role", async () => {
    const member = await workspaceWithTask("member");
    mockAuthenticatedSession(member.user);

    const response = await projectAccessApi()(`/project/${member.project.id}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(403);
    expect(await readErrorBody(response)).toMatchObject({
      message: "Insufficient permissions",
      code: "MISSING_PERMISSION",
    });
  });
});

describe("instance admins need an existing workspace", () => {
  it("returns 404 instead of an empty list for a missing workspace", async () => {
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);

    const response = await projectAccessApi()(
      `/project?workspaceId=workspace-${randomUUID()}`,
    );

    expect(response.status).toBe(404);
    expect(await readErrorBody(response)).toMatchObject({
      message: "Workspace not found",
      code: "NOT_FOUND",
    });
  });

  it("returns 404 instead of a server error when creating a project in a missing workspace", async () => {
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);

    const response = await projectAccessApi()("/project", {
      method: "POST",
      body: {
        workspaceId: `workspace-${randomUUID()}`,
        name: "Orphan",
        icon: "Folder",
        slug: "orphan",
      },
    });

    expect(response.status).toBe(404);
    expect(await readErrorBody(response)).toMatchObject({
      message: "Workspace not found",
      code: "NOT_FOUND",
    });
  });

  it("still reads a workspace the admin never joined", async () => {
    const other = await workspaceWithTask();
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);

    const response = await projectAccessApi()(
      `/project?workspaceId=${other.workspace.id}`,
    );

    expect(response.status).toBe(200);
    const projects = (await response.json()) as { id: string }[];
    expect(projects.map((project) => project.id)).toEqual([other.project.id]);
  });
});

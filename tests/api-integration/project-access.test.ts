import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { createRestrictedWorkspace } from "./helpers/project-access/create-restricted-workspace";
import { projectAccessApi } from "./helpers/project-access/project-access-api";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

beforeEach(resetTestDatabase);

describe("project access enforcement", () => {
  it("lists only the projects a restricted member can access", async () => {
    const ctx = await createRestrictedWorkspace();
    mockAuthenticatedSession(ctx.restricted);

    const response = await projectAccessApi()(
      `/project?workspaceId=${ctx.workspace.id}`,
    );

    expect(response.status).toBe(200);
    const projects = (await response.json()) as { id: string }[];
    expect(projects.map((project) => project.id)).toEqual([ctx.alpha.id]);
  });

  it("blocks every read of a project outside the selection", async () => {
    const ctx = await createRestrictedWorkspace();
    mockAuthenticatedSession(ctx.restricted);
    const request = projectAccessApi();

    const hidden = [
      `/project/${ctx.beta.id}`,
      `/task/tasks/${ctx.beta.id}`,
      `/task/${ctx.betaTask.id}`,
      `/task/${ctx.betaTask.id}/description`,
      `/task/export/${ctx.beta.id}`,
      `/column/${ctx.beta.id}`,
      `/comment/${ctx.betaTask.id}`,
      `/activity/${ctx.betaTask.id}`,
      `/label/task/${ctx.betaTask.id}`,
      `/time-entry/task/${ctx.betaTask.id}`,
      `/task-relation/${ctx.betaTask.id}`,
      `/custom-field/project/${ctx.beta.id}`,
      `/external-link/task/${ctx.betaTask.id}`,
      `/workflow-rule/${ctx.beta.id}`,
    ];
    for (const path of hidden) {
      expect({ path, status: (await request(path)).status }).toEqual({
        path,
        status: 403,
      });
    }

    for (const path of [
      `/project/${ctx.alpha.id}`,
      `/task/tasks/${ctx.alpha.id}`,
      `/task/${ctx.alphaTask.id}`,
    ]) {
      expect({ path, status: (await request(path)).status }).toEqual({
        path,
        status: 200,
      });
    }
  });

  it("blocks writes to a project outside the selection", async () => {
    const ctx = await createRestrictedWorkspace();
    mockAuthenticatedSession(ctx.restricted);
    const request = projectAccessApi();

    const title = await request(`/task/title/${ctx.betaTask.id}`, {
      method: "PUT",
      body: { title: "Renamed" },
    });
    expect(title.status).toBe(403);

    const created = await request(`/task/${ctx.beta.id}`, {
      method: "POST",
      body: {
        title: "Sneaky",
        description: "",
        priority: "low",
        status: "to-do",
      },
    });
    expect(created.status).toBe(403);

    const bulk = await request("/task/bulk", {
      method: "PATCH",
      body: {
        taskIds: [ctx.alphaTask.id, ctx.betaTask.id],
        operation: "updatePriority",
        value: "high",
      },
    });
    expect(bulk.status).toBe(403);

    const moved = await request(`/task/move/${ctx.alphaTask.id}`, {
      method: "PUT",
      body: { destinationProjectId: ctx.beta.id },
    });
    expect(moved.status).toBe(403);
  });

  it("filters search, assigned tasks and ticket lookups", async () => {
    const ctx = await createRestrictedWorkspace();
    mockAuthenticatedSession(ctx.restricted);
    const request = projectAccessApi();

    const search = await request(
      `/search?workspaceId=${ctx.workspace.id}&q=task&type=tasks`,
    );
    expect(search.status).toBe(200);
    const searchBody = JSON.stringify(await search.json());
    expect(searchBody).toContain("Visible alpha task");
    expect(searchBody).not.toContain("Hidden beta task");

    const assigned = await request(
      `/task/assigned?workspaceId=${ctx.workspace.id}`,
    );
    expect(assigned.status).toBe(200);
    const assignedBody = JSON.stringify(await assigned.json());
    expect(assignedBody).toContain("Visible alpha task");
    expect(assignedBody).not.toContain("Hidden beta task");

    expect((await request("/task/by-ticket-id/ALPHA-1")).status).toBe(200);
    expect((await request("/task/by-ticket-id/BETA-1")).status).toBe(404);
  });

  it("hides notifications about tasks in other projects", async () => {
    const ctx = await createRestrictedWorkspace();
    await db.insert(schema.notificationTable).values([
      {
        userId: ctx.restricted.id,
        resourceType: "task",
        resourceId: ctx.alphaTask.id,
        eventData: { taskTitle: "Visible alpha task" },
      },
      {
        userId: ctx.restricted.id,
        resourceType: "task",
        resourceId: ctx.betaTask.id,
        eventData: { taskTitle: "Hidden beta task" },
      },
    ]);
    mockAuthenticatedSession(ctx.restricted);

    const response = await projectAccessApi()("/notification");

    expect(response.status).toBe(200);
    const body = JSON.stringify(await response.json());
    expect(body).toContain("Visible alpha task");
    expect(body).not.toContain("Hidden beta task");
  });

  it("leaves owners and unrestricted members unaffected", async () => {
    const ctx = await createRestrictedWorkspace();
    const unrestricted = await addWorkspaceMember(ctx.workspace.id);

    for (const user of [ctx.owner, unrestricted]) {
      mockAuthenticatedSession(user);
      const response = await projectAccessApi()(
        `/project?workspaceId=${ctx.workspace.id}`,
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toHaveLength(2);
      expect(
        (await projectAccessApi()(`/task/${ctx.betaTask.id}`)).status,
      ).toBe(200);
    }
  });

  it("applies the member's project access to their API keys", async () => {
    const ctx = await createRestrictedWorkspace();
    mockAnonymousSession();
    const key = `kaneo_test_${randomUUID()}`;
    await db.insert(schema.apikeyTable).values({
      referenceId: ctx.restricted.id,
      userId: ctx.restricted.id,
      key: createHash("sha256").update(key).digest("base64url"),
      name: "restricted key",
      createdAt: new Date(),
      updatedAt: new Date(),
      enabled: true,
    });
    const request = projectAccessApi({ Authorization: `Bearer ${key}` });

    expect((await request(`/project/${ctx.beta.id}`)).status).toBe(403);
    expect((await request(`/project/${ctx.alpha.id}`)).status).toBe(200);
  });

  it("only offers and accepts assignees who can see the project", async () => {
    const ctx = await createRestrictedWorkspace();
    await db
      .update(schema.taskTable)
      .set({ userId: null })
      .where(eq(schema.taskTable.id, ctx.betaTask.id));
    mockAuthenticatedSession(ctx.owner);
    const request = projectAccessApi();

    const members = await request(
      `/workspace/${ctx.workspace.id}/members?projectId=${ctx.beta.id}`,
    );
    expect(members.status).toBe(200);
    const memberIds = ((await members.json()) as { id: string }[]).map(
      (member) => member.id,
    );
    expect(memberIds).toContain(ctx.owner.id);
    expect(memberIds).not.toContain(ctx.restricted.id);

    const assigned = await request(`/task/assignee/${ctx.betaTask.id}`, {
      method: "PUT",
      body: { userId: ctx.restricted.id },
    });
    expect(assigned.status).toBe(403);
    expect(await assigned.text()).toContain(
      "Assignee does not have access to this project",
    );

    mockAuthenticatedSession(ctx.restricted);
    const peek = await projectAccessApi()(
      `/workspace/${ctx.workspace.id}/members?projectId=${ctx.beta.id}`,
    );
    expect(peek.status).toBe(403);
  });

  it("unassigns a task moved into a project its assignee can't see", async () => {
    const ctx = await createRestrictedWorkspace();
    mockAuthenticatedSession(ctx.owner);

    const moved = await projectAccessApi()(`/task/move/${ctx.alphaTask.id}`, {
      method: "PUT",
      body: { destinationProjectId: ctx.beta.id },
    });

    expect(moved.status).toBe(200);
    const [task] = await db
      .select({ userId: schema.taskTable.userId })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, ctx.alphaTask.id));
    expect(task?.userId).toBeNull();
  });

  it("hides the source project of a move from members who can't see it", async () => {
    const ctx = await createRestrictedWorkspace();
    const betaOnly = await addWorkspaceMember(ctx.workspace.id);
    await restrictToProjects(ctx.workspace.id, betaOnly.id, [ctx.beta.id]);
    mockAuthenticatedSession(ctx.owner);
    const moved = await projectAccessApi()(`/task/move/${ctx.alphaTask.id}`, {
      method: "PUT",
      body: { destinationProjectId: ctx.beta.id },
    });
    expect(moved.status).toBe(200);

    const expectHiddenSource = () =>
      vi.waitFor(async () => {
        mockAuthenticatedSession(betaOnly);
        const response = await projectAccessApi()(
          `/activity/${ctx.alphaTask.id}`,
        );
        const activities = (await response.json()) as {
          type: string;
          eventData: Record<string, unknown> | null;
        }[];
        expect(
          activities.find((activity) => activity.type === "moved")?.eventData,
        ).toMatchObject({
          fromProjectId: null,
          fromProjectName: null,
          toProjectId: ctx.beta.id,
          toProjectName: "Beta",
        });
      });
    await expectHiddenSource();

    mockAuthenticatedSession(ctx.owner);
    const deleted = await projectAccessApi()(`/project/${ctx.alpha.id}`, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(200);
    await expectHiddenSource();
  });

  it("keeps tasks editable after their assignee loses access", async () => {
    const ctx = await createRestrictedWorkspace();
    mockAuthenticatedSession(ctx.owner);
    const request = projectAccessApi();

    const updated = await request(`/task/${ctx.betaTask.id}`, {
      method: "PUT",
      body: {
        title: "Still editable",
        priority: "high",
        status: ctx.betaTask.status,
        projectId: ctx.beta.id,
        position: 0,
        userId: ctx.restricted.id,
      },
    });
    expect(updated.status).toBe(200);

    const duplicated = await request(`/task/duplicate/${ctx.betaTask.id}`, {
      method: "POST",
      body: {},
    });
    expect(duplicated.status).toBe(200);
    const copy = (await duplicated.json()) as { userId: string | null };
    expect(copy.userId).toBeNull();
  });

  it("keeps a restricted member's access to projects they create", async () => {
    const ctx = await createRestrictedWorkspace();
    mockAuthenticatedSession(ctx.restricted);
    const request = projectAccessApi();

    const created = await request("/project", {
      method: "POST",
      body: {
        name: "Gamma",
        workspaceId: ctx.workspace.id,
        icon: "Layout",
        slug: "gamma",
      },
    });
    expect(created.status).toBe(200);
    const project = (await created.json()) as { id: string };

    expect((await request(`/project/${project.id}`)).status).toBe(200);
  });
});

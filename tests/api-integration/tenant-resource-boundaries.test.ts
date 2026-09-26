import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import deleteLabel from "../../apps/api/src/label/controllers/delete-label";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const { syncGithub, syncGitea, removeGithub, removeGitea, publish } =
  vi.hoisted(() => ({
    syncGithub: vi.fn(async () => undefined),
    syncGitea: vi.fn(async () => undefined),
    removeGithub: vi.fn(async () => undefined),
    removeGitea: vi.fn(async () => undefined),
    publish: vi.fn(async () => undefined),
  }));
vi.mock("../../apps/api/src/plugins/github/utils/sync-label-to-github", () => ({
  syncLabelToGitHub: syncGithub,
  removeLabelFromGitHub: removeGithub,
}));
vi.mock("../../apps/api/src/plugins/gitea/utils/sync-label-to-gitea", () => ({
  syncLabelToGitea: syncGitea,
  removeLabelFromGitea: removeGitea,
}));
vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<object>()),
  publishEvent: publish,
}));

async function context() {
  const member = await createWorkspaceMember();
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      title: "Private task",
      projectId: project.id,
      number: 1,
    })
    .returning();
  return { ...member, project, task };
}
function request(path: string, method: string, body?: unknown) {
  return createApp().app.request(`/api${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
}
async function label(workspaceId: string, taskId: string | null) {
  const [row] = await db
    .insert(schema.labelTable)
    .values({
      workspaceId,
      taskId,
      name: "bug",
      color: "#ff0000",
    })
    .returning();
  return row;
}

describe("tenant resource boundaries", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    vi.clearAllMocks();
  });

  it("rejects foreign and nonexistent task IDs before creating or syncing a label", async () => {
    const own = await context();
    const foreign = await context();
    mockAuthenticatedSession(own.user);
    for (const taskId of [foreign.task.id, "missing-task"]) {
      const response = await request("/label", "POST", {
        name: "bug",
        color: "#ff0000",
        workspaceId: own.workspace.id,
        taskId,
      });
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Task not found");
    }
    expect(await db.select().from(schema.labelTable)).toHaveLength(0);
    expect(syncGithub).not.toHaveBeenCalled();
    expect(syncGitea).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(
      (
        await request("/label", "POST", {
          name: "bug",
          color: "#ff0000",
          workspaceId: own.workspace.id,
          taskId: own.task.id,
        })
      ).status,
    ).toBe(200);
    expect(syncGithub).toHaveBeenCalledWith(own.task.id, "bug", "#ff0000");
    expect(syncGitea).toHaveBeenCalledWith(own.task.id, "bug", "#ff0000");
  });

  it("rejects legacy cross-workspace label rows at every label-ID endpoint", async () => {
    const own = await context();
    const foreign = await context();
    const forged = await label(own.workspace.id, foreign.task.id);
    mockAuthenticatedSession(own.user);
    for (const [suffix, method, body] of [
      ["", "GET", undefined],
      ["", "DELETE", undefined],
      ["", "PUT", { name: "changed", color: "#ffffff" }],
      ["/task", "DELETE", undefined],
      ["/task", "PUT", { taskId: own.task.id }],
    ] as const) {
      expect(
        (await request(`/label/${forged.id}${suffix}`, method, body)).status,
      ).toBe(400);
    }
    await expect(deleteLabel(forged.id, own.user.id)).rejects.toMatchObject({
      status: 404,
    });
    expect(await db.select().from(schema.labelTable)).toEqual([forged]);
    expect(syncGithub).not.toHaveBeenCalled();
    expect(syncGitea).not.toHaveBeenCalled();
    expect(removeGithub).not.toHaveBeenCalled();
    expect(removeGitea).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("does not sync or publish foreign tasks when cleaning up a workspace label", async () => {
    const own = await context();
    const foreign = await context();
    const root = await label(own.workspace.id, null);
    await label(own.workspace.id, own.task.id);
    await label(own.workspace.id, foreign.task.id);
    const untouched = await label(foreign.workspace.id, null);
    mockAuthenticatedSession(own.user);
    expect((await request(`/label/${root.id}`, "DELETE")).status).toBe(200);
    expect(await db.select().from(schema.labelTable)).toEqual([untouched]);
    expect(removeGithub.mock.calls).toEqual([[own.task.id, "bug"]]);
    expect(removeGitea.mock.calls).toEqual([[own.task.id, "bug"]]);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      "task.label_deleted",
      expect.objectContaining({ taskId: own.task.id }),
      { waitForHandlers: true },
    );
  });

  it("uses the same response for missing and foreign move destinations and still permits local moves", async () => {
    const own = await context();
    const foreign = await context();
    mockAuthenticatedSession(own.user);
    const responses = [];
    for (const destinationProjectId of [
      "missing-project",
      foreign.project.id,
    ]) {
      const response = await request(`/task/move/${own.task.id}`, "PUT", {
        destinationProjectId,
      });
      responses.push({ status: response.status, body: await response.text() });
    }
    expect(responses).toEqual([
      { status: 404, body: "Project not found" },
      { status: 404, body: "Project not found" },
    ]);
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, own.task.id),
      }),
    ).toEqual(own.task);
    expect(publish).not.toHaveBeenCalled();
    const { project } = await createProjectFixture({
      workspaceId: own.workspace.id,
    });
    const response = await request(`/task/move/${own.task.id}`, "PUT", {
      destinationProjectId: project.id,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      task: { id: own.task.id, projectId: project.id },
    });
    expect(publish).toHaveBeenCalledWith(
      "task.moved",
      expect.objectContaining({ toProjectId: project.id }),
    );
  });
});

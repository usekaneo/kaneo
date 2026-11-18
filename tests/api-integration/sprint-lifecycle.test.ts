import { randomUUID } from "node:crypto";
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
import { readErrorBody } from "./helpers/error-body";

type App = ReturnType<typeof createApp>["app"];

type Sprint = {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  carryOverTasks: Array<{ id: string; title: string }> | null;
  position: number;
  taskCount: number;
  completedTaskCount: number;
};

type SeededTask = typeof schema.taskTable.$inferSelect;

// Creates a second user with the admin role inside an existing workspace, so
// one fixture can cover both the member and the sprint-manager perspective.
async function seedWorkspaceAdmin(workspaceId: string) {
  const userId = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id: userId,
      email: `${userId}@example.com`,
      emailVerified: true,
      name: "Sprint Admin",
    })
    .returning();

  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId,
    role: "admin",
    joinedAt: new Date(),
  });

  return user!;
}

async function sprintJson(
  app: App,
  path: string,
  method: "POST" | "PUT",
  body: unknown = {},
) {
  return app.request(`/api/sprint${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

async function createSprintViaApi(
  app: App,
  projectId: string,
  body: Record<string, unknown> = {},
) {
  const response = await sprintJson(app, `/${projectId}`, "POST", body);
  return { response, sprint: (await response.json()) as Sprint };
}

async function startSprintViaApi(app: App, sprintId: string, body = {}) {
  const response = await sprintJson(app, `/start/${sprintId}`, "POST", body);
  return { response, sprint: (await response.json()) as Sprint };
}

async function seedTask({
  projectId,
  sprintId = null,
  status = "to-do",
  columnId = null,
  title = "Seeded task",
  type = "task",
  number,
  position = 1,
}: {
  projectId: string;
  sprintId?: string | null;
  status?: string;
  columnId?: string | null;
  title?: string;
  type?: "task" | "bug";
  number: number;
  position?: number;
}): Promise<SeededTask> {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      title,
      description: "",
      status,
      columnId,
      priority: "medium",
      type,
      sprintId,
      number,
      position,
    })
    .returning();
  return task!;
}

// Standard opening: a member-owned workspace plus an admin who can manage
// sprints. createWorkspaceMember defaults to the "member" role, which lacks
// project:update and therefore cannot manage sprints (F-F1 in docs/sprints).
async function sprintSetup() {
  const member = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const admin = await seedWorkspaceAdmin(member.workspace.id);

  mockAuthenticatedSession(admin);
  const { app } = createApp();
  return { member, admin, project, columns, app };
}

// Creates and starts one sprint, the state most lifecycle rules build on.
async function activeSprint(app: App, projectId: string, name = "Sprint 1") {
  const { sprint } = await createSprintViaApi(app, projectId, { name });
  const started = await startSprintViaApi(app, sprint.id);
  expect(started.response.status).toBe(200);
  return started.sprint;
}

describe("API integration: sprint lifecycle", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects unauthenticated sprint requests", async () => {
    const { project, app } = await sprintSetup();

    mockAnonymousSession();
    const created = await sprintJson(app, `/${project.id}`, "POST", {});
    expect(created.status).toBe(401);
    expect(await readErrorBody(created)).toMatchObject({
      message: "Unauthorized",
      code: "UNAUTHORIZED",
    });

    const list = await app.request(`/api/sprint/${project.id}`);
    expect(list.status).toBe(401);
  });

  it("requires project:update to manage sprints, keeping members read-only", async () => {
    const { member, project, app } = await sprintSetup();

    mockAuthenticatedSession(member);
    const denied = await sprintJson(app, `/${project.id}`, "POST", {});
    expect(denied.status).toBe(403);
    expect(await readErrorBody(denied)).toEqual({
      message: "Insufficient permissions",
      code: "MISSING_PERMISSION",
      missingPermissions: ["project:update"],
    });

    // The same member may still read the sprint list (project:read).
    const list = await app.request(`/api/sprint/${project.id}`);
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual([]);
  });

  it("hides sprints from users outside the workspace", async () => {
    const { project, app } = await sprintSetup();

    const outsider = await createWorkspaceMember();
    mockAuthenticatedSession(outsider.user);
    const list = await app.request(`/api/sprint/${project.id}`);

    // 404, not 403: the endpoint must not reveal that the project exists.
    expect(list.status).toBe(404);
    expect(await readErrorBody(list)).toMatchObject({
      message: "Project not found",
      code: "NOT_FOUND",
    });
  });

  it("appends sprints with the next free generated name and lists them in order", async () => {
    const { project, app } = await sprintSetup();

    const first = await createSprintViaApi(app, project.id);
    expect(first.response.status).toBe(200);
    expect(first.sprint).toMatchObject({
      projectId: project.id,
      name: "Sprint 1",
      status: "future",
      position: 0,
      taskCount: 0,
      completedTaskCount: 0,
    });

    const second = await createSprintViaApi(app, project.id);
    expect(second.sprint).toMatchObject({ name: "Sprint 2", position: 1 });

    const named = await createSprintViaApi(app, project.id, {
      name: "Launch week",
      goal: "Ship the beta",
    });
    expect(named.sprint).toMatchObject({
      name: "Launch week",
      goal: "Ship the beta",
      position: 2,
    });

    const list = (await (
      await app.request(`/api/sprint/${project.id}`)
    ).json()) as Sprint[];
    expect(list.map((sprint) => sprint.name)).toEqual([
      "Sprint 1",
      "Sprint 2",
      "Launch week",
    ]);
  });

  it("rejects duplicate sprint names within a project", async () => {
    const { project, app } = await sprintSetup();

    const first = await createSprintViaApi(app, project.id, { name: "Alpha" });
    expect(first.response.status).toBe(200);

    const duplicate = await createSprintViaApi(app, project.id, {
      name: "Alpha",
    });
    expect(duplicate.response.status).toBe(409);
    expect(await readErrorBody(duplicate)).toMatchObject({
      message: 'Sprint "Alpha" already exists in this project',
      code: "CONFLICT",
    });
  });

  it("starts a sprint with dates derived from the project's default length", async () => {
    const { project, app } = await sprintSetup();
    await db
      .update(schema.projectTable)
      .set({ defaultSprintLengthDays: 7 })
      .where(eq(schema.projectTable.id, project.id));

    const { sprint } = await createSprintViaApi(app, project.id);
    const { response, sprint: started } = await startSprintViaApi(
      app,
      sprint.id,
      {
        startDate: "2026-05-01",
      },
    );

    expect(response.status).toBe(200);
    expect(started).toMatchObject({ status: "active" });
    expect(started.startDate).toBe("2026-05-01T00:00:00.000Z");
    expect(started.endDate).toBe("2026-05-08T00:00:00.000Z");
  });

  it("allows only one active sprint per project and no restart of closed sprints", async () => {
    const { project, app } = await sprintSetup();

    const active = await activeSprint(app, project.id, "Sprint 1");
    const { sprint: second } = await createSprintViaApi(app, project.id, {
      name: "Sprint 2",
    });

    const secondStart = await startSprintViaApi(app, second.id);
    expect(secondStart.response.status).toBe(409);
    expect(await readErrorBody(secondStart.response)).toMatchObject({
      message:
        'Sprint "Sprint 1" is already active. Close it before starting another sprint.',
      code: "CONFLICT",
    });

    // Closed sprints stay closed forever (BR-6 in docs/sprints).
    const closed = await sprintJson(app, `/close/${active.id}`, "POST", {
      targetSprintId: second.id,
    });
    expect(closed.status).toBe(200);

    const restart = await startSprintViaApi(app, active.id);
    expect(restart.response.status).toBe(409);
    expect(await readErrorBody(restart.response)).toMatchObject({
      message: "Closed sprints cannot be restarted",
      code: "CONFLICT",
    });
  });

  it("keeps closed sprints immutable and the active sprint's start frozen", async () => {
    const { project, app } = await sprintSetup();

    const active = await activeSprint(app, project.id, "Sprint 1");
    const { sprint: future } = await createSprintViaApi(app, project.id, {
      name: "Sprint 2",
    });

    // Renaming a future sprint works.
    const rename = await sprintJson(app, `/${future.id}`, "PUT", {
      name: "Sprint 2 (stretch)",
    });
    expect(rename.status).toBe(200);
    expect(((await rename.json()) as Sprint).name).toBe("Sprint 2 (stretch)");

    // Renaming to an existing name collides.
    const clash = await sprintJson(app, `/${future.id}`, "PUT", {
      name: "Sprint 1",
    });
    expect(clash.status).toBe(409);

    // The active sprint is already running: its start cannot move.
    const moveStart = await sprintJson(app, `/${active.id}`, "PUT", {
      startDate: "2026-06-01",
    });
    expect(moveStart.status).toBe(400);
    expect(await readErrorBody(moveStart)).toMatchObject({
      message:
        "Only future sprints can change their start date; the active sprint is already running",
      code: "BAD_REQUEST",
    });

    // Closed sprints are immutable history.
    const closed = await sprintJson(app, `/close/${active.id}`, "POST", {
      targetSprintId: null,
    });
    expect(closed.status).toBe(200);

    const editClosed = await sprintJson(app, `/${active.id}`, "PUT", {
      name: "Renamed after close",
    });
    expect(editClosed.status).toBe(409);
    expect(await readErrorBody(editClosed)).toMatchObject({
      message:
        "Closed sprints are immutable. Their tasks stay as the history of what was implemented.",
      code: "CONFLICT",
    });
  });

  it("routes bugs to the active sprint and everything else to the backlog", async () => {
    const { admin, project, app } = await sprintSetup();

    const active = await activeSprint(app, project.id, "Sprint 1");

    const postTask = (body: Record<string, unknown>) =>
      app.request(`/api/task/${project.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Probe",
          description: "",
          priority: "low",
          status: "to-do",
          ...body,
        }),
      });

    mockAuthenticatedSession(admin);
    const bug = await postTask({ type: "bug" });
    expect(bug.status).toBe(200);
    expect(((await bug.json()) as SeededTask).sprintId).toBe(active.id);

    const task = await postTask({ type: "task" });
    expect(((await task.json()) as SeededTask).sprintId).toBeNull();

    const unspecified = await postTask({});
    expect(((await unspecified.json()) as SeededTask).sprintId).toBeNull();

    // Without an active sprint even bugs fall back to the backlog.
    const { project: otherProject } = await createProjectFixture({
      workspaceId: project.workspaceId,
    });

    const otherBug = await app.request(`/api/task/${otherProject.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "No sprint bug",
        description: "",
        priority: "low",
        status: "to-do",
        type: "bug",
      }),
    });
    expect(otherBug.status).toBe(200);
    expect(((await otherBug.json()) as SeededTask).sprintId).toBeNull();
  });

  it("lets members move tasks between open sprints but never into or out of closed ones", async () => {
    const { member, admin, project, columns, app } = await sprintSetup();

    const active = await activeSprint(app, project.id, "Sprint 1");
    const { sprint: future } = await createSprintViaApi(app, project.id, {
      name: "Sprint 2",
    });

    const task = await seedTask({
      projectId: project.id,
      columnId: columns.todo.id,
      number: 1,
    });

    mockAuthenticatedSession(member);
    const assign = await sprintJson(app, `/task/${task.id}`, "PUT", {
      sprintId: future.id,
    });
    expect(assign.status).toBe(200);
    expect(await assign.json()).toEqual({
      id: task.id,
      projectId: project.id,
      sprintId: future.id,
    });

    const backlog = await sprintJson(app, `/task/${task.id}`, "PUT", {
      sprintId: null,
    });
    expect(backlog.status).toBe(200);
    expect(
      ((await backlog.json()) as { sprintId: string | null }).sprintId,
    ).toBeNull();

    // Close the sprint, then verify both closed-sprint guardrails.
    mockAuthenticatedSession(admin);
    const closed = await sprintJson(app, `/close/${active.id}`, "POST", {
      targetSprintId: future.id,
    });
    expect(closed.status).toBe(200);

    const history = await seedTask({
      projectId: project.id,
      sprintId: active.id,
      columnId: columns.done.id,
      status: "done",
      number: 2,
    });

    mockAuthenticatedSession(member);
    const intoClosed = await sprintJson(app, `/task/${task.id}`, "PUT", {
      sprintId: active.id,
    });
    expect(intoClosed.status).toBe(409);
    expect(await readErrorBody(intoClosed)).toMatchObject({
      message: "Cannot assign tasks to a closed sprint",
      code: "CONFLICT",
    });

    const outOfClosed = await sprintJson(app, `/task/${history.id}`, "PUT", {
      sprintId: null,
    });
    expect(outOfClosed.status).toBe(409);
    expect(await readErrorBody(outOfClosed)).toMatchObject({
      message:
        "The task belongs to a closed sprint and stays there as implementation history",
      code: "CONFLICT",
    });

    // A sprint from another project is never a valid target.
    mockAuthenticatedSession(admin);
    const { project: otherProject } = await createProjectFixture({
      workspaceId: project.workspaceId,
    });
    const { sprint: foreign } = await createSprintViaApi(app, otherProject.id);

    mockAuthenticatedSession(member);
    const foreignTarget = await sprintJson(app, `/task/${task.id}`, "PUT", {
      sprintId: foreign.id,
    });
    expect(foreignTarget.status).toBe(404);
    expect(await readErrorBody(foreignTarget)).toMatchObject({
      message: "Target sprint not found in this project",
      code: "NOT_FOUND",
    });
  });

  it("reorders future sprints but rejects non-future ones", async () => {
    const { project, app } = await sprintSetup();

    const a = await createSprintViaApi(app, project.id, { name: "Sprint A" });
    const b = await createSprintViaApi(app, project.id, { name: "Sprint B" });
    const c = await createSprintViaApi(app, project.id, { name: "Sprint C" });

    const swap = await sprintJson(app, `/reorder/${project.id}`, "POST", {
      sprints: [
        { id: a.sprint.id, position: 1 },
        { id: b.sprint.id, position: 0 },
      ],
    });
    expect(swap.status).toBe(200);
    expect(((await swap.json()) as Sprint[]).map((s) => s.name)).toEqual([
      "Sprint B",
      "Sprint A",
      "Sprint C",
    ]);

    // Only future sprints may move; the active sprint is running.
    const started = await startSprintViaApi(app, a.sprint.id);
    expect(started.response.status).toBe(200);

    const moveActive = await sprintJson(app, `/reorder/${project.id}`, "POST", {
      sprints: [{ id: a.sprint.id, position: 5 }],
    });
    expect(moveActive.status).toBe(400);
    expect(await readErrorBody(moveActive)).toMatchObject({
      message: `Sprint ${a.sprint.id} does not exist in this project, or is not a future sprint`,
      code: "BAD_REQUEST",
    });
  });

  it("closes the active sprint, moving unfinished tasks and freezing the history", async () => {
    const { project, columns, app } = await sprintSetup();

    const active = await activeSprint(app, project.id, "Sprint 1");
    const { sprint: target } = await createSprintViaApi(app, project.id, {
      name: "Sprint 2",
    });

    const unfinished = await seedTask({
      projectId: project.id,
      sprintId: active.id,
      columnId: columns.todo.id,
      title: "Unfinished work",
      number: 1,
    });
    const completed = await seedTask({
      projectId: project.id,
      sprintId: active.id,
      columnId: columns.done.id,
      status: "done",
      title: "Completed work",
      number: 2,
    });

    const closed = await sprintJson(app, `/close/${active.id}`, "POST", {
      targetSprintId: target.id,
    });
    expect(closed.status).toBe(200);

    const payload = (await closed.json()) as {
      sprint: Sprint;
      movedTaskIds: string[];
      targetSprintId: string;
    };
    expect(payload.movedTaskIds).toEqual([unfinished.id]);
    expect(payload.targetSprintId).toBe(target.id);
    expect(payload.sprint.status).toBe("closed");
    expect(payload.sprint.carryOverTasks).toEqual([
      { id: unfinished.id, title: "Unfinished work" },
    ]);

    // The move is persisted: unfinished work continues, completed work stays.
    const movedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, unfinished.id),
    });
    expect(movedTask?.sprintId).toBe(target.id);

    const completedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, completed.id),
    });
    expect(completedTask?.sprintId).toBe(active.id);

    // The list response reports the frozen history of the closed sprint.
    const list = (await (
      await app.request(`/api/sprint/${project.id}`)
    ).json()) as Sprint[];
    const closedRow = list.find((sprint) => sprint.id === active.id);
    expect(closedRow).toMatchObject({ taskCount: 1, completedTaskCount: 1 });
    const targetRow = list.find((sprint) => sprint.id === target.id);
    expect(targetRow).toMatchObject({ taskCount: 1, completedTaskCount: 0 });

    // Closing is a one-way transition, and only the active sprint closes.
    const reClose = await sprintJson(app, `/close/${active.id}`, "POST", {
      targetSprintId: null,
    });
    expect(reClose.status).toBe(409);
    expect(await readErrorBody(reClose)).toMatchObject({
      message: "Sprint is already closed",
      code: "CONFLICT",
    });

    const closeFuture = await sprintJson(app, `/close/${target.id}`, "POST", {
      targetSprintId: null,
    });
    expect(closeFuture.status).toBe(409);
    expect(await readErrorBody(closeFuture)).toMatchObject({
      message: "Only the active sprint can be closed",
      code: "CONFLICT",
    });
  });

  it("moves carry-over tasks to the backlog for a null target and rejects non-future targets", async () => {
    const { project, columns, app } = await sprintSetup();

    const active = await activeSprint(app, project.id, "Sprint 1");
    const { sprint: next } = await createSprintViaApi(app, project.id, {
      name: "Sprint 2",
    });

    const unfinished = await seedTask({
      projectId: project.id,
      sprintId: active.id,
      columnId: columns.todo.id,
      title: "Backlog bound",
      number: 1,
    });

    // A closed sprint is never a valid carry-over target.
    const carried = await sprintJson(app, `/close/${active.id}`, "POST", {
      targetSprintId: next.id,
    });
    expect(carried.status).toBe(200);

    const startedNext = await startSprintViaApi(app, next.id);
    expect(startedNext.response.status).toBe(200);

    const intoClosed = await sprintJson(app, `/close/${next.id}`, "POST", {
      targetSprintId: active.id,
    });
    expect(intoClosed.status).toBe(400);
    expect(await readErrorBody(intoClosed)).toMatchObject({
      message: "Unfinished tasks can only move to a future sprint",
      code: "BAD_REQUEST",
    });

    // Null moves every unfinished task to the backlog instead.
    const closeBacklog = await sprintJson(app, `/close/${next.id}`, "POST", {
      targetSprintId: null,
    });
    expect(closeBacklog.status).toBe(200);

    const payload = (await closeBacklog.json()) as {
      movedTaskIds: string[];
      targetSprintId: string | null;
    };
    expect(payload.movedTaskIds).toEqual([unfinished.id]);
    expect(payload.targetSprintId).toBeNull();

    const movedTask = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, unfinished.id),
    });
    expect(movedTask?.sprintId).toBeNull();
  });
});

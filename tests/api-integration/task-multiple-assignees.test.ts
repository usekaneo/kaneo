import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import "../../apps/api/src/notification";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { handOverPrimaryAssignments } from "../../apps/api/src/task/assignees/hand-over-primary-assignments";
import { createRestrictedWorkspace } from "./helpers/project-access/create-restricted-workspace";
import { projectAccessApi } from "./helpers/project-access/project-access-api";
import { putMemberProjectAccess } from "./helpers/project-access/put-member-project-access";

vi.mock("../../apps/api/src/events", async (original) => {
  const events = await original<typeof import("../../apps/api/src/events")>();
  return {
    ...events,
    // Assertions must wait for the notification and activity subscribers.
    publishEvent: (...args: Parameters<typeof events.publishEvent>) =>
      events.publishEvent(args[0], args[1], { waitForHandlers: true }),
  };
});

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});

type Ctx = Awaited<ReturnType<typeof setup>>;

async function setup() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const alice = await addWorkspaceMember(owner.workspace.id);
  const bob = await addWorkspaceMember(owner.workspace.id);
  const carol = await addWorkspaceMember(owner.workspace.id);
  const fixture = await createProjectFixture({
    workspaceId: owner.workspace.id,
  });
  const task = await seedTask(fixture, 1);
  mockAuthenticatedSession(owner.user);
  return { owner, alice, bob, carol, fixture, task };
}

async function seedTask(
  fixture: Awaited<ReturnType<typeof createProjectFixture>>,
  number: number,
  userId?: string,
) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: fixture.project.id,
      title: `Task ${number}`,
      status: fixture.columns.todo.slug,
      columnId: fixture.columns.todo.id,
      number,
      position: number,
      userId,
    })
    .returning();
  await db
    .update(schema.projectTable)
    .set({ lastTaskNumber: number })
    .where(eq(schema.projectTable.id, fixture.project.id));
  return task;
}

function call(path: string, method = "GET", body?: unknown) {
  return createApp().app.request(`/api${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5173",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const setAssignees = (taskId: string, body: unknown) =>
  call(`/task/assignee/${taskId}`, "PUT", body);

async function assigneeRows(taskId: string) {
  const rows = await db
    .select({ userId: schema.taskAssigneeTable.userId })
    .from(schema.taskAssigneeTable)
    .where(eq(schema.taskAssigneeTable.taskId, taskId))
    .orderBy(schema.taskAssigneeTable.createdAt);
  return rows.map((row) => row.userId);
}

async function primaryOf(taskId: string) {
  const [row] = await db
    .select({ userId: schema.taskTable.userId })
    .from(schema.taskTable)
    .where(eq(schema.taskTable.id, taskId));
  return row?.userId ?? null;
}

const notificationsFor = (userId: string) =>
  db
    .select()
    .from(schema.notificationTable)
    .where(
      and(
        eq(schema.notificationTable.userId, userId),
        eq(schema.notificationTable.type, "task_assignee_changed"),
      ),
    );

describe("multiple assignees: compatibility with the single assignee", () => {
  it("backfills task_assignee from existing assignee_id values", async () => {
    const { alice, fixture } = await setup();
    const legacy = await seedTask(fixture, 2, alice.id);
    const unassigned = await seedTask(fixture, 3);
    await db.delete(schema.taskAssigneeTable);

    const migration = readFileSync(
      resolve(__dirname, "../../apps/api/drizzle/0071_common_black_crow.sql"),
      "utf8",
    );
    const backfill = migration
      .split("--> statement-breakpoint")
      .find((statement) => statement.includes('INSERT INTO "task_assignee"'));
    expect(backfill).toBeDefined();
    await db.execute(sql.raw(backfill as string));
    // Running it twice must stay harmless.
    await db.execute(sql.raw(backfill as string));

    expect(await assigneeRows(legacy.id)).toEqual([alice.id]);
    expect(await assigneeRows(unassigned.id)).toEqual([]);
  });

  it("reads a task written with only the primary column as assigned to it", async () => {
    const { alice, fixture } = await setup();
    const legacy = await seedTask(fixture, 2, alice.id);

    const response = await call(`/task/${legacy.id}`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      userId: alice.id,
      assigneeId: alice.id,
      assigneeIds: [alice.id],
    });
    expect(body.assignees.map((a: { id: string }) => a.id)).toEqual([alice.id]);
  });

  it("keeps the single-user endpoint working and replaces the set", async () => {
    const { alice, bob, task } = await setup();
    await setAssignees(task.id, { assigneeIds: [alice.id, bob.id] });

    const response = await setAssignees(task.id, { userId: bob.id });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ userId: bob.id, assigneeIds: [bob.id] });
    expect(await assigneeRows(task.id)).toEqual([bob.id]);

    await setAssignees(task.id, { userId: null });
    expect(await primaryOf(task.id)).toBeNull();
    expect(await assigneeRows(task.id)).toEqual([]);
  });

  it("does not drop co-assignees when an older client echoes the primary on a full update", async () => {
    const { alice, bob, task, fixture } = await setup();
    await setAssignees(task.id, { assigneeIds: [alice.id, bob.id] });

    const response = await call(`/task/${task.id}`, "PUT", {
      title: "Renamed",
      status: fixture.columns.todo.slug,
      priority: "high",
      projectId: fixture.project.id,
      position: task.position ?? 1,
      userId: alice.id,
    });

    expect(response.status).toBe(200);
    expect(await assigneeRows(task.id)).toEqual([alice.id, bob.id]);
    expect(await primaryOf(task.id)).toBe(alice.id);
  });
});

describe("multiple assignees: deleted primary", () => {
  it("hands the primary to the next assignee before the user is deleted", async () => {
    const { alice, bob, carol, task } = await setup();
    await setAssignees(task.id, { assigneeIds: [alice.id, bob.id, carol.id] });

    await handOverPrimaryAssignments(alice.id);
    await db.delete(schema.userTable).where(eq(schema.userTable.id, alice.id));

    expect(await primaryOf(task.id)).toBe(bob.id);
    expect(await assigneeRows(task.id)).toEqual([bob.id, carol.id]);
  });

  it("leaves no primary only when nobody else is assigned", async () => {
    const { alice, task } = await setup();
    await setAssignees(task.id, { assigneeIds: [alice.id] });

    await handOverPrimaryAssignments(alice.id);
    await db.delete(schema.userTable).where(eq(schema.userTable.id, alice.id));

    expect(await primaryOf(task.id)).toBeNull();
    expect(await assigneeRows(task.id)).toEqual([]);
  });

  it("does not let a plain edit by a member drop or reject co-assignees when the stored primary is already missing", async () => {
    const { owner, alice, bob, carol, task, fixture } = await setup();
    await setAssignees(task.id, { assigneeIds: [bob.id, carol.id] });
    // A row left behind by a deletion that predates the hand-over.
    await db
      .update(schema.taskTable)
      .set({ userId: null })
      .where(eq(schema.taskTable.id, task.id));
    const member = await addWorkspaceMember(owner.workspace.id);
    mockAuthenticatedSession(member);

    // Readers report the first assignee as primary, and clients echo it back.
    const response = await call(`/task/${task.id}`, "PUT", {
      title: "Renamed by a member",
      status: fixture.columns.todo.slug,
      priority: "high",
      projectId: fixture.project.id,
      position: task.position ?? 1,
      userId: bob.id,
    });

    expect(response.status).toBe(200);
    expect(await assigneeRows(task.id)).toEqual([bob.id, carol.id]);
    expect(alice.id).toBeDefined();
  });
});

describe("multiple assignees: the assignee endpoint contract", () => {
  it("rejects an empty body instead of unassigning everyone", async () => {
    const { alice, bob, task } = await setup();
    await setAssignees(task.id, { assigneeIds: [alice.id, bob.id] });

    const response = await setAssignees(task.id, {});

    expect(response.status).toBe(400);
    expect(await assigneeRows(task.id)).toEqual([alice.id, bob.id]);
  });

  it("makes one person the only assignee with assigneeIds, but keeps the set when the current primary is echoed", async () => {
    const { alice, bob, task } = await setup();
    await setAssignees(task.id, { assigneeIds: [alice.id, bob.id] });

    await setAssignees(task.id, { userId: alice.id });
    expect(await assigneeRows(task.id)).toEqual([alice.id, bob.id]);

    await setAssignees(task.id, { assigneeIds: [alice.id] });
    expect(await assigneeRows(task.id)).toEqual([alice.id]);
  });
});

describe("multiple assignees: adding and removing people", () => {
  it("adds several people, keeps the first as primary and removes one at a time", async () => {
    const { alice, bob, carol, task } = await setup();

    const added = await setAssignees(task.id, {
      assigneeIds: [alice.id, bob.id, carol.id, alice.id],
    });
    expect(added.status).toBe(200);
    expect(await added.json()).toMatchObject({
      userId: alice.id,
      assigneeIds: [alice.id, bob.id, carol.id],
    });
    expect(await assigneeRows(task.id)).toEqual([alice.id, bob.id, carol.id]);

    // Removing the primary hands the role to the next person in line.
    await setAssignees(task.id, { assigneeIds: [bob.id, carol.id] });
    expect(await primaryOf(task.id)).toBe(bob.id);

    // The primary stays put while it is still assigned.
    await setAssignees(task.id, { assigneeIds: [carol.id, bob.id] });
    expect(await primaryOf(task.id)).toBe(bob.id);

    await setAssignees(task.id, { assigneeIds: [] });
    expect(await primaryOf(task.id)).toBeNull();
    expect(await assigneeRows(task.id)).toEqual([]);
  });

  it("supports assigneeIds when creating a task", async () => {
    const { alice, bob, fixture } = await setup();

    const response = await call(`/task/${fixture.project.id}`, "POST", {
      title: "Lead",
      description: "",
      priority: "medium",
      status: fixture.columns.todo.slug,
      assigneeIds: [bob.id, alice.id],
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      userId: bob.id,
      assigneeIds: [bob.id, alice.id],
    });
    expect(await assigneeRows(body.id)).toEqual([bob.id, alice.id]);
  });

  it("tells every assignee when a task is created with several", async () => {
    const { alice, bob, carol, fixture } = await setup();

    await call(`/task/${fixture.project.id}`, "POST", {
      title: "Shared lead",
      description: "",
      priority: "medium",
      status: fixture.columns.todo.slug,
      assigneeIds: [alice.id, bob.id],
    });

    const created = (userId: string) =>
      db
        .select()
        .from(schema.notificationTable)
        .where(
          and(
            eq(schema.notificationTable.userId, userId),
            eq(schema.notificationTable.type, "task_created"),
          ),
        );
    expect(await created(alice.id)).toHaveLength(1);
    expect(await created(bob.id)).toHaveLength(1);
    expect(await created(carol.id)).toHaveLength(0);
  });

  it("bulk assign replaces the whole set with one person", async () => {
    const { alice, bob, task, fixture } = await setup();
    const second = await seedTask(fixture, 2);
    await setAssignees(task.id, { assigneeIds: [alice.id, bob.id] });

    const response = await call("/task/bulk", "PATCH", {
      taskIds: [task.id, second.id],
      operation: "updateAssignee",
      value: bob.id,
    });

    expect(response.status).toBe(200);
    expect(await assigneeRows(task.id)).toEqual([bob.id]);
    expect(await assigneeRows(second.id)).toEqual([bob.id]);
    expect(await primaryOf(task.id)).toBe(bob.id);
  });

  it("bulk assign handles tasks in different starting states in one go", async () => {
    const { alice, bob, carol, task, fixture } = await setup();
    const unassigned = await seedTask(fixture, 2);
    const alreadyBob = await seedTask(fixture, 3);
    const legacy = await seedTask(fixture, 4, carol.id);
    await setAssignees(task.id, { assigneeIds: [alice.id, bob.id, carol.id] });
    await setAssignees(alreadyBob.id, { assigneeIds: [bob.id, alice.id] });

    const ids = [task.id, unassigned.id, alreadyBob.id, legacy.id];
    const assign = await call("/task/bulk", "PATCH", {
      taskIds: ids,
      operation: "updateAssignee",
      value: bob.id,
    });
    expect(assign.status).toBe(200);
    for (const id of ids) {
      expect(await assigneeRows(id)).toEqual([bob.id]);
      expect(await primaryOf(id)).toBe(bob.id);
    }

    const clear = await call("/task/bulk", "PATCH", {
      taskIds: ids,
      operation: "updateAssignee",
      value: null,
    });
    expect(clear.status).toBe(200);
    for (const id of ids) {
      expect(await assigneeRows(id)).toEqual([]);
      expect(await primaryOf(id)).toBeNull();
    }
  });

  it("limits the number of assignees", async () => {
    const { task } = await setup();
    const response = await setAssignees(task.id, {
      assigneeIds: Array.from({ length: 21 }, () => randomUUID()),
    });
    expect(response.status).toBe(400);
  });
});

describe("multiple assignees: workspace and project boundaries", () => {
  it("rejects a person from another workspace and writes nothing", async () => {
    const { alice, task } = await setup();
    const outsider = await createWorkspaceMember();

    const response = await setAssignees(task.id, {
      assigneeIds: [alice.id, outsider.user.id],
    });

    expect(response.status).toBe(403);
    expect(await assigneeRows(task.id)).toEqual([]);
    expect(await primaryOf(task.id)).toBeNull();

    const created = await call(`/task/${task.projectId}`, "POST", {
      title: "x",
      description: "",
      priority: "low",
      status: "to-do",
      assigneeIds: [outsider.user.id],
    });
    expect(created.status).toBe(403);
  });

  it("rejects a restricted member who cannot open the project", async () => {
    const ctx = await createRestrictedWorkspace();
    const other = await addWorkspaceMember(ctx.workspace.id);
    // The fixture assigns the restricted member to both tasks; start clean.
    await db.delete(schema.taskAssigneeTable);
    await db.update(schema.taskTable).set({ userId: null });
    mockAuthenticatedSession(ctx.owner);
    const visible = await setAssignees(ctx.alphaTask.id, {
      assigneeIds: [other.id, ctx.restricted.id],
    });
    expect(visible.status).toBe(200);

    const hidden = await setAssignees(ctx.betaTask.id, {
      assigneeIds: [other.id, ctx.restricted.id],
    });
    expect(hidden.status).toBe(403);
    expect(await assigneeRows(ctx.betaTask.id)).not.toContain(
      ctx.restricted.id,
    );
  });

  it("removes a member from every task they lose access to, keeping co-assignees", async () => {
    const ctx = await createRestrictedWorkspace();
    const other = await addWorkspaceMember(ctx.workspace.id);
    const member = await addWorkspaceMember(ctx.workspace.id);
    mockAuthenticatedSession(ctx.owner);
    await setAssignees(ctx.betaTask.id, { assigneeIds: [member.id, other.id] });

    const response = await putMemberProjectAccess(
      projectAccessApi(),
      ctx.workspace.id,
      member.id,
      { projectAccess: "selected", projectIds: [ctx.alpha.id] },
    );

    expect(response.status).toBe(200);
    expect(await assigneeRows(ctx.betaTask.id)).toEqual([other.id]);
    expect(await primaryOf(ctx.betaTask.id)).toBe(other.id);
  });
});

describe("multiple assignees: listings", () => {
  it("includes tasks where the user is any assignee in assigned tasks and in the assignee filter", async () => {
    const { owner, alice, bob, task, fixture } = await setup();
    const other = await seedTask(fixture, 2);
    await setAssignees(task.id, { assigneeIds: [alice.id, bob.id] });

    mockAuthenticatedSession(bob);
    const mine = await call(`/task/assigned?workspaceId=${owner.workspace.id}`);
    const mineBody = await mine.json();
    expect(mineBody.total).toBe(1);
    expect(mineBody.tasks.map((t: { id: string }) => t.id)).toEqual([task.id]);

    const count = await call(
      `/task/assigned?workspaceId=${owner.workspace.id}&countOnly=true`,
    );
    expect((await count.json()).total).toBe(1);

    const board = await call(
      `/task/tasks/${fixture.project.id}?assigneeId=${bob.id}`,
    );
    const boardBody = await board.json();
    const ids = boardBody.data.columns.flatMap(
      (column: { tasks: { id: string }[] }) =>
        column.tasks.map((t: { id: string }) => t.id),
    );
    expect(ids).toEqual([task.id]);
    expect(ids).not.toContain(other.id);

    const card = boardBody.data.columns
      .flatMap((column: { tasks: unknown[] }) => column.tasks)
      .find((t: { id: string }) => t.id === task.id);
    expect(card).toMatchObject({
      userId: alice.id,
      assigneeIds: [alice.id, bob.id],
    });
    expect(card.assignees).toHaveLength(2);
  });
});

describe("multiple assignees: notifications", () => {
  it("notifies only the people added by each change", async () => {
    const { owner, alice, bob, carol, task } = await setup();

    await setAssignees(task.id, { assigneeIds: [alice.id] });
    expect(await notificationsFor(alice.id)).toHaveLength(1);

    await setAssignees(task.id, { assigneeIds: [alice.id, bob.id] });
    expect(await notificationsFor(alice.id)).toHaveLength(1);
    expect(await notificationsFor(bob.id)).toHaveLength(1);

    // Dropping someone notifies nobody; adding carol notifies only carol.
    await setAssignees(task.id, { assigneeIds: [bob.id, carol.id] });
    expect(await notificationsFor(alice.id)).toHaveLength(1);
    expect(await notificationsFor(bob.id)).toHaveLength(1);
    expect(await notificationsFor(carol.id)).toHaveLength(1);
    expect(await notificationsFor(owner.user.id)).toHaveLength(0);
  });

  it("tells every assignee about a comment", async () => {
    const { owner, alice, bob, task } = await setup();
    await setAssignees(task.id, { assigneeIds: [alice.id, bob.id] });

    const response = await call(`/activity/comment`, "POST", {
      taskId: task.id,
      comment: "ping",
    });
    expect(response.status).toBe(200);

    for (const user of [alice, bob]) {
      const rows = await db
        .select()
        .from(schema.notificationTable)
        .where(
          and(
            eq(schema.notificationTable.userId, user.id),
            eq(schema.notificationTable.type, "task_comment"),
          ),
        );
      expect(rows).toHaveLength(1);
    }
    expect(owner.user.id).toBeDefined();
  });
});

describe("multiple assignees: duplicate and move", () => {
  it("copies every assignee when duplicating", async () => {
    const { alice, bob, task } = await setup();
    await setAssignees(task.id, { assigneeIds: [alice.id, bob.id] });

    const response = await call(`/task/duplicate/${task.id}`, "POST", {});
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      userId: alice.id,
      assigneeIds: [alice.id, bob.id],
    });
    expect(await assigneeRows(body.id)).toEqual([alice.id, bob.id]);
  });

  it("refuses a manual copy when one assignee has left the workspace", async () => {
    const { alice, bob, task, owner } = await setup();
    await setAssignees(task.id, { assigneeIds: [alice.id, bob.id] });
    await db
      .delete(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.userId, bob.id),
          eq(schema.workspaceUserTable.workspaceId, owner.workspace.id),
        ),
      );

    const response = await call(`/task/duplicate/${task.id}`, "POST", {});
    expect(response.status).toBe(403);
  });

  it("drops assignees who cannot open the destination project when a task moves", async () => {
    const ctx = await createRestrictedWorkspace();
    const other = await addWorkspaceMember(ctx.workspace.id);
    mockAuthenticatedSession(ctx.owner);
    await setAssignees(ctx.alphaTask.id, {
      assigneeIds: [ctx.restricted.id, other.id],
    });

    const response = await call(`/task/move/${ctx.alphaTask.id}`, "PUT", {
      destinationProjectId: ctx.beta.id,
    });

    expect(response.status).toBe(200);
    expect(await assigneeRows(ctx.alphaTask.id)).toEqual([other.id]);
    expect(await primaryOf(ctx.alphaTask.id)).toBe(other.id);
  });

  it("drops assignees outside the target workspace when a project moves", async () => {
    const { owner, alice, bob, task, fixture } = await setup();
    await setAssignees(task.id, { assigneeIds: [alice.id, bob.id] });
    const [target] = await db
      .insert(schema.workspaceTable)
      .values({
        id: `workspace-${randomUUID()}`,
        createdAt: new Date(),
        name: "Target",
        slug: `workspace-${randomUUID()}`,
      })
      .returning();
    for (const [userId, role] of [
      [owner.user.id, "owner"],
      [bob.id, "member"],
    ] as const) {
      await db.insert(schema.workspaceUserTable).values({
        workspaceId: target.id,
        userId,
        role,
        joinedAt: new Date(),
      });
    }

    const response = await call(`/project/${fixture.project.id}/move`, "PUT", {
      workspaceId: target.id,
    });

    expect(response.status).toBe(200);
    expect(await assigneeRows(task.id)).toEqual([bob.id]);
    // alice was the primary and is not in the target workspace.
    expect(await primaryOf(task.id)).toBe(bob.id);
  });
});

export type { Ctx };

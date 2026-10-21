import { checkDueDateReminders } from "../../apps/api/src/scheduler/due-date-reminders";
import { DUE_DATE_DURATION_MS } from "../../apps/api/src/scheduler/reminder-timing";
import { handleMemberRemoved } from "../../apps/api/src/workspace-members/handle-member-removed";
import { unassignInaccessibleTasks } from "../../apps/api/src/project-access/unassign-inaccessible-tasks";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { getDatabase, schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { getTaskAssignees } from "../../apps/api/src/task/assignees/get-task-assignees";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

// Await the real event subscribers so notification assertions and the next
// TRUNCATE cannot race background work. External notification delivery is separate.
vi.mock("../../apps/api/src/events", async (original) => {
  const actual = await original<typeof import("../../apps/api/src/events")>();
  return {
    ...actual,
    publishEvent: (type: string, data: unknown) =>
      actual.publishEvent(type, data, { waitForHandlers: true }),
  };
});
vi.mock("../../apps/api/src/notification-preferences/delivery", () => ({
  deliverNotification: vi.fn(async () => {}),
}));

vi.mock("../../apps/api/src/billing/controllers/sync-seats", () => ({
  syncWorkspaceSeats: vi.fn(async () => {}),
}));

async function scene() {
  const actor = await createWorkspaceMember({ role: "owner" });
  const people = await Promise.all(
    ["Ada", "Grace", "Linus"].map((userName) =>
      createWorkspaceMember({ userName }),
    ),
  );
  for (const person of people)
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: actor.workspace.id,
      userId: person.user.id,
      role: "member",
      joinedAt: new Date(),
    });
  const [a, b, c] = people;
  const project = await createProjectFixture({
    workspaceId: actor.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.project.id,
      title: "Shared work",
      description: "",
      status: "to-do",
      columnId: project.columns.todo.id,
      priority: "medium",
      userId: a.user.id,
      position: 1,
      number: 1,
    })
    .returning();
  await db
    .update(schema.projectTable)
    .set({ lastTaskNumber: 1 })
    .where(eq(schema.projectTable.id, project.project.id));
  mockAuthenticatedSession(actor.user);
  const { app } = createApp();
  const request = (path: string, method = "GET", body?: unknown) =>
    app.request(path, {
      method,
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
  const assigned = async () =>
    ((await getTaskAssignees([task.id])).get(task.id) ?? []).map(
      (person) => person.id,
    );
  const put = (assigneeIds: string[]) =>
    request(`/api/task/${task.id}/assignees`, "PUT", { assigneeIds });
  return { actor, a, b, c, project, task, request, put, assigned };
}

describe("API integration: multiple assignees", () => {
  beforeEach(resetTestDatabase);

  it("keeps existing single assignments readable without a backfill", async () => {
    const s = await scene();
    const response = await s.request(`/api/task/${s.task.id}`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.userId).toBe(s.a.user.id);
    expect(body.assignees.map((person: { id: string }) => person.id)).toEqual([
      s.a.user.id,
    ]);
  });

  it("sets, adds, removes, and clears people without replacing unrelated assignees", async () => {
    const s = await scene();
    expect((await s.put([s.a.user.id, s.b.user.id, s.a.user.id])).status).toBe(
      200,
    );
    expect(await s.assigned()).toEqual([s.a.user.id, s.b.user.id]);
    expect(
      (
        await s.request(`/api/task/${s.task.id}/assignees`, "POST", {
          userId: s.c.user.id,
        })
      ).status,
    ).toBe(200);
    expect(await s.assigned()).toEqual([s.a.user.id, s.b.user.id, s.c.user.id]);
    expect(
      (
        await s.request(
          `/api/task/${s.task.id}/assignees/${s.a.user.id}`,
          "DELETE",
        )
      ).status,
    ).toBe(200);
    expect(await s.assigned()).toEqual([s.b.user.id, s.c.user.id]);
    expect((await s.put([])).status).toBe(200);
    expect(await s.assigned()).toEqual([]);
  });

  it("does not lose independent concurrent additions", async () => {
    const s = await scene();
    const results = await Promise.all(
      [s.b, s.c].map((person) =>
        s.request(`/api/task/${s.task.id}/assignees`, "POST", {
          userId: person.user.id,
        }),
      ),
    );
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(new Set(await s.assigned())).toEqual(
      new Set([s.a.user.id, s.b.user.id, s.c.user.id]),
    );
  });

  it("does not emit duplicate assignment activity for repeated additions", async () => {
    const s = await scene();
    for (let i = 0; i < 2; i++)
      expect(
        (
          await s.request(`/api/task/${s.task.id}/assignees`, "POST", {
            userId: s.b.user.id,
          })
        ).status,
      ).toBe(200);
    const rows = await db
      .select()
      .from(schema.activityTable)
      .where(
        and(
          eq(schema.activityTable.taskId, s.task.id),
          eq(schema.activityTable.type, "assignee_changed"),
        ),
      );
    expect(rows).toHaveLength(1);
    expect(await s.assigned()).toEqual([s.a.user.id, s.b.user.id]);
  });

  it("rejects an ineligible person atomically", async () => {
    const s = await scene();
    const outsider = await createWorkspaceMember();
    expect((await s.put([s.b.user.id, outsider.user.id])).status).toBe(403);
    expect(await s.assigned()).toEqual([s.a.user.id]);
  });

  it("rejects workspace members who cannot access this project", async () => {
    const s = await scene();
    await db.insert(schema.workspaceMemberAccessTable).values({
      workspaceId: s.actor.workspace.id,
      userId: s.b.user.id,
      projectAccess: "selected",
    });
    expect(
      (
        await s.request(`/api/task/${s.task.id}/assignees`, "POST", {
          userId: s.b.user.id,
        })
      ).status,
    ).toBe(403);
    expect(await s.assigned()).toEqual([s.a.user.id]);
  });

  it("enforces assignment permission on each new endpoint and full updates", async () => {
    const s = await scene();
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: s.actor.workspace.id,
      role: "editor-only",
      permission: JSON.stringify({
        project: ["read"],
        task: ["read", "update"],
      }),
    });
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "editor-only" })
      .where(
        and(
          eq(schema.workspaceUserTable.workspaceId, s.actor.workspace.id),
          eq(schema.workspaceUserTable.userId, s.c.user.id),
        ),
      );
    mockAuthenticatedSession(s.c.user);
    for (const [path, method, body] of [
      [
        `/api/task/${s.task.id}/assignees`,
        "PUT",
        { assigneeIds: [s.b.user.id] },
      ],
      [`/api/task/${s.task.id}/assignees`, "POST", { userId: s.b.user.id }],
      [`/api/task/${s.task.id}/assignees/${s.a.user.id}`, "DELETE", undefined],
      [
        `/api/task/${s.task.id}`,
        "PUT",
        { ...s.task, assigneeIds: [s.b.user.id] },
      ],
    ] as const)
      expect((await s.request(path, method, body)).status).toBe(403);
    expect(await s.assigned()).toEqual([s.a.user.id]);
  });

  it("preserves the set when older clients omit or echo the first user in full updates", async () => {
    const s = await scene();
    await s.put([s.a.user.id, s.b.user.id]);
    const {
      userId: _userId,
      startDate: _startDate,
      dueDate: _dueDate,
      ...fields
    } = s.task;
    for (const body of [fields, { ...fields, userId: s.a.user.id }]) {
      expect(
        (
          await s.request(`/api/task/${s.task.id}`, "PUT", {
            ...body,
            title: "Edited",
          })
        ).status,
      ).toBe(200);
      expect(await s.assigned()).toEqual([s.a.user.id, s.b.user.id]);
    }
  });

  it("does not let an echoed legacy owner undo a concurrent assignment", async () => {
    const s = await scene();
    await s.put([s.a.user.id, s.b.user.id]);
    const transaction = db.transaction.bind(db);
    vi.spyOn(getDatabase(), "transaction").mockImplementationOnce(
      async (apply, config) => {
        await db
          .update(schema.taskTable)
          .set({ userId: s.c.user.id })
          .where(eq(schema.taskTable.id, s.task.id));
        return transaction(apply, config);
      },
    );
    const { startDate: _start, dueDate: _due, ...fields } = s.task;
    const response = await s.request(`/api/task/${s.task.id}`, "PUT", {
      ...fields,
      title: "Edited concurrently",
    });
    expect(response.status).toBe(200);
    expect(await s.assigned()).toEqual([s.c.user.id, s.b.user.id]);
  });

  it("keeps explicit legacy reassignment and unassignment semantics", async () => {
    const s = await scene();
    await s.put([s.a.user.id, s.b.user.id]);
    expect(
      (
        await s.request(`/api/task/assignee/${s.task.id}`, "PUT", {
          userId: s.c.user.id,
        })
      ).status,
    ).toBe(200);
    expect(await s.assigned()).toEqual([s.c.user.id]);
    expect(
      (
        await s.request(`/api/task/assignee/${s.task.id}`, "PUT", {
          userId: null,
        })
      ).status,
    ).toBe(200);
    expect(await s.assigned()).toEqual([]);
  });

  it("creates all assignments in the create transaction and notifies every assignee", async () => {
    const s = await scene();
    const response = await s.request(
      `/api/task/${s.project.project.id}`,
      "POST",
      {
        title: "Pair on this",
        description: "",
        status: "to-do",
        priority: "medium",
        assigneeIds: [s.a.user.id, s.b.user.id],
      },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.assignees.map((person: { id: string }) => person.id)).toEqual([
      s.a.user.id,
      s.b.user.id,
    ]);
    const notifications = await db
      .select()
      .from(schema.notificationTable)
      .where(eq(schema.notificationTable.resourceId, body.id));
    expect(new Set(notifications.map((row) => row.userId))).toEqual(
      new Set([s.a.user.id, s.b.user.id]),
    );
  });

  it("matches additional assignees in project filters, board summaries, and My Tasks", async () => {
    const s = await scene();
    await s.put([s.a.user.id, s.b.user.id]);
    const filtered = await s.request(
      `/api/task/tasks/${s.project.project.id}?assigneeId=${s.b.user.id}`,
    );
    expect(filtered.status).toBe(200);
    const board = await filtered.json();
    expect(board.pagination.total).toBe(1);
    expect(
      board.data.columns
        .flatMap(
          (column: { tasks: { assignees: { id: string }[] }[] }) =>
            column.tasks,
        )[0]
        .assignees.map((person: { id: string }) => person.id),
    ).toEqual([s.a.user.id, s.b.user.id]);
    mockAuthenticatedSession(s.b.user);
    const mine = await s.request(
      `/api/task/assigned?workspaceId=${s.actor.workspace.id}`,
    );
    expect(mine.status).toBe(200);
    expect(
      (await mine.json()).tasks.map((task: { id: string }) => task.id),
    ).toEqual([s.task.id]);
  });

  it("supports atomic bulk add/remove while preserving unrelated owners", async () => {
    const s = await scene();
    for (const mode of ["add", "remove"] as const) {
      expect(
        (
          await s.request("/api/task/bulk", "PATCH", {
            taskIds: [s.task.id],
            operation: "updateAssignee",
            value: s.b.user.id,
            assigneeMode: mode,
          })
        ).status,
      ).toBe(200);
      expect(await s.assigned()).toEqual(
        mode === "add" ? [s.a.user.id, s.b.user.id] : [s.a.user.id],
      );
    }
  });

  it.each([null, [""], ["   "], Array.from({ length: 101 }, () => "x")])(
    "rejects malformed or oversized sets: %j",
    async (assigneeIds) => {
      const s = await scene();
      expect(
        (
          await s.request(`/api/task/${s.task.id}/assignees`, "PUT", {
            assigneeIds,
          })
        ).status,
      ).toBe(400);
      expect(await s.assigned()).toEqual([s.a.user.id]);
    },
  );

  it("rekeys existing personal reminders during upgrade without changing webhook reminders", async () => {
    const s = await scene();
    const migrationName = readdirSync(
      resolve(import.meta.dirname, "../../apps/api/drizzle"),
    ).find((name) => name.startsWith("0064_") && name.endsWith(".sql"))!;
    const migration = readFileSync(
      resolve(import.meta.dirname, "../../apps/api/drizzle", migrationName),
      "utf8",
    );
    await db.transaction(async (tx) => {
      await tx.execute(sql`drop table task_co_assignee`);
      await tx.insert(schema.taskReminderSentTable).values([
        { taskId: s.task.id, reminderType: "overdue" },
        { taskId: s.task.id, reminderType: "configured_before" },
        { taskId: s.task.id, reminderType: "generic_webhook:test" },
      ]);
      for (const statement of migration.split("--> statement-breakpoint"))
        if (statement.trim()) await tx.execute(sql.raw(statement));
      const rows = await tx
        .select()
        .from(schema.taskReminderSentTable)
        .where(eq(schema.taskReminderSentTable.taskId, s.task.id));
      expect(new Set(rows.map((row) => row.reminderType))).toEqual(
        new Set([
          `overdue:${s.a.user.id}`,
          `configured_before:${s.a.user.id}`,
          "generic_webhook:test",
        ]),
      );
    });
    expect(await s.assigned()).toEqual([s.a.user.id]);
  });
  it("serializes concurrent replacements instead of accidentally merging sets", async () => {
    const s = await scene();
    const responses = await Promise.all([
      s.put([s.b.user.id]),
      s.put([s.c.user.id]),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const ids = await s.assigned();
    expect(ids).toHaveLength(1);
    expect([s.b.user.id, s.c.user.id]).toContain(ids[0]);
  });

  it("notifies all other assignees about status and comments without notifying the actor", async () => {
    const s = await scene();
    await s.put([s.a.user.id, s.b.user.id]);
    await db.delete(schema.notificationTable);
    mockAuthenticatedSession(s.a.user);
    expect(
      (
        await s.request(`/api/task/status/${s.task.id}`, "PUT", {
          status: "in-progress",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await s.request("/api/activity/comment", "POST", {
          taskId: s.task.id,
          comment: "Let's pair on this",
        })
      ).status,
    ).toBe(200);
    const notifications = await db
      .select()
      .from(schema.notificationTable)
      .where(eq(schema.notificationTable.resourceId, s.task.id));
    expect(notifications.map((row) => row.userId)).toEqual([
      s.b.user.id,
      s.b.user.id,
    ]);
    expect(new Set(notifications.map((row) => row.type))).toEqual(
      new Set(["task_status_changed", "task_comment"]),
    );
  });

  it("removes just one person and records that removal without claiming the task is unassigned", async () => {
    const s = await scene();
    await s.put([s.a.user.id, s.b.user.id]);
    await db.delete(schema.notificationTable);
    expect(
      (
        await s.request(
          `/api/task/${s.task.id}/assignees/${s.b.user.id}`,
          "DELETE",
        )
      ).status,
    ).toBe(200);
    expect(await s.assigned()).toEqual([s.a.user.id]);
    const activity = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, s.task.id));
    expect(
      activity.filter((row) => row.type === "assignee_removed"),
    ).toHaveLength(1);
    expect(activity.filter((row) => row.type === "unassigned")).toHaveLength(0);
    expect(await db.select().from(schema.notificationTable)).toHaveLength(0);
  });

  it("respects each person's reminder lead time and claims reminders per person", async () => {
    const s = await scene();
    await s.put([s.a.user.id, s.b.user.id]);
    await db.delete(schema.notificationTable);
    await db
      .update(schema.taskTable)
      .set({ dueDate: new Date(Date.now() - 5 * 60_000) })
      .where(eq(schema.taskTable.id, s.task.id));
    await db
      .insert(schema.userNotificationPreferenceTable)
      .values({ userId: s.b.user.id, dueDateReminderLeadTimeMinutes: 60 });
    expect(await checkDueDateReminders()).toEqual({ degraded: false });
    let rows = await db.select().from(schema.notificationTable);
    expect(rows.map((row) => row.userId)).toEqual([s.a.user.id]);
    await db
      .update(schema.userNotificationPreferenceTable)
      .set({ dueDateReminderLeadTimeMinutes: 1440 })
      .where(eq(schema.userNotificationPreferenceTable.userId, s.b.user.id));
    await checkDueDateReminders();
    await checkDueDateReminders();
    rows = await db.select().from(schema.notificationTable);
    expect(new Set(rows.map((row) => row.userId))).toEqual(
      new Set([s.a.user.id, s.b.user.id]),
    );
    expect(rows).toHaveLength(2);
    const claims = await db.select().from(schema.taskReminderSentTable);
    expect(new Set(claims.map((row) => row.reminderType))).toEqual(
      new Set([
        `configured_before:${s.a.user.id}`,
        `configured_before:${s.b.user.id}`,
      ]),
    );
  });

  it("sends one overdue reminder to each current assignee", async () => {
    const s = await scene();
    await s.put([s.a.user.id, s.b.user.id]);
    await db.delete(schema.notificationTable);
    await db
      .update(schema.taskTable)
      .set({
        dueDate: new Date(Date.now() - DUE_DATE_DURATION_MS - 5 * 60_000),
      })
      .where(eq(schema.taskTable.id, s.task.id));
    await checkDueDateReminders();
    await checkDueDateReminders();
    const rows = await db.select().from(schema.notificationTable);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.type))).toEqual(
      new Set(["task_overdue"]),
    );
  });

  it("removes additional assignees when project access is revoked", async () => {
    const s = await scene();
    await s.put([s.a.user.id, s.b.user.id]);
    await db.insert(schema.workspaceMemberAccessTable).values({
      workspaceId: s.actor.workspace.id,
      userId: s.b.user.id,
      projectAccess: "selected",
    });
    await db.transaction((tx) =>
      unassignInaccessibleTasks(tx, {
        workspaceId: s.actor.workspace.id,
        userId: s.b.user.id,
        actorId: s.actor.user.id,
      }),
    );
    expect(await s.assigned()).toEqual([s.a.user.id]);
  });

  it("removes first and additional assignments when a member leaves the workspace", async () => {
    const s = await scene();
    await s.put([s.a.user.id, s.b.user.id]);
    for (const person of [s.a, s.b]) {
      await db
        .delete(schema.workspaceUserTable)
        .where(
          and(
            eq(schema.workspaceUserTable.workspaceId, s.actor.workspace.id),
            eq(schema.workspaceUserTable.userId, person.user.id),
          ),
        );
      await handleMemberRemoved({
        workspaceId: s.actor.workspace.id,
        userId: person.user.id,
        userRole: null,
      });
    }
    expect(await s.assigned()).toEqual([]);
  });

  it("preserves ownership when duplicating and exporting/importing a task", async () => {
    const s = await scene();
    await s.put([s.a.user.id, s.b.user.id]);
    const copied = await s.request(`/api/task/duplicate/${s.task.id}`, "POST", {
      title: "Copy",
    });
    expect(copied.status).toBe(200);
    const copy = await copied.json();
    expect(
      (await getTaskAssignees([copy.id]))
        .get(copy.id)
        ?.map((person) => person.id),
    ).toEqual([s.a.user.id, s.b.user.id]);
    const exported = await s.request(
      `/api/task/export/${s.project.project.id}`,
    );
    expect(exported.status).toBe(200);
    const body = await exported.json();
    expect(body.tasks[0].assigneeIds).toEqual([s.a.user.id, s.b.user.id]);
    const imported = await s.request(
      `/api/task/import/${s.project.project.id}`,
      "POST",
      { tasks: [body.tasks[0]] },
    );
    expect(imported.status).toBe(200);
    const importedBody = await imported.json();
    expect(importedBody.results.successful).toBe(1);
    const importedId = importedBody.results.tasks[0].task.id;
    expect(
      (await getTaskAssignees([importedId]))
        .get(importedId)
        ?.map((person) => person.id),
    ).toEqual([s.a.user.id, s.b.user.id]);
  });

  it("drops only assignees who cannot access the destination project", async () => {
    const s = await scene();
    await s.put([s.a.user.id, s.b.user.id]);
    const destination = await createProjectFixture({
      workspaceId: s.actor.workspace.id,
    });
    await db.insert(schema.workspaceMemberAccessTable).values({
      workspaceId: s.actor.workspace.id,
      userId: s.b.user.id,
      projectAccess: "selected",
    });
    await db.insert(schema.workspaceMemberProjectTable).values({
      workspaceId: s.actor.workspace.id,
      userId: s.b.user.id,
      projectId: s.project.project.id,
    });
    expect(
      (
        await s.request(`/api/task/move/${s.task.id}`, "PUT", {
          destinationProjectId: destination.project.id,
        })
      ).status,
    ).toBe(200);
    expect(await s.assigned()).toEqual([s.a.user.id]);
  });

  it("drops additional assignments outside the destination workspace on project moves", async () => {
    const s = await scene();
    await s.put([s.a.user.id, s.b.user.id]);
    const destination = await createWorkspaceMember({ role: "owner" });
    for (const person of [s.actor, s.a])
      await db.insert(schema.workspaceUserTable).values({
        workspaceId: destination.workspace.id,
        userId: person.user.id,
        role: "owner",
        joinedAt: new Date(),
      });
    expect(
      (
        await s.request(`/api/project/${s.project.project.id}/move`, "PUT", {
          workspaceId: destination.workspace.id,
        })
      ).status,
    ).toBe(200);
    expect(await s.assigned()).toEqual([s.a.user.id]);
  });
});

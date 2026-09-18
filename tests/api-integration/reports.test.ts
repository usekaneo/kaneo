import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { zonedDay } from "../../apps/api/src/company/zoned-time";
import db, { schema } from "../../apps/api/src/database";
import { addWorkspaceMember, requestAs } from "./helpers/company";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
});

async function setup() {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "owner",
  });
  await db.insert(schema.companySettingsTable).values({
    workspaceId: workspace.id,
    timezone: "Asia/Dhaka",
    workDays: "1,2,3,4,5,6,7",
  });
  const alice = await addWorkspaceMember(workspace.id, "member", "Alice");
  const mona = await addWorkspaceMember(workspace.id, "manager", "Mona");
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
    name: "Website",
  });
  const today = zonedDay(new Date(), "Asia/Dhaka");
  return { owner, workspace, alice, mona, project, columns, today };
}

let taskNumber = 0;

async function task(
  projectId: string,
  columnId: string,
  status: string,
  values: Partial<typeof schema.taskTable.$inferInsert> = {},
) {
  const [row] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      columnId,
      status,
      title: "Task",
      // Numbers are unique per project.
      number: ++taskNumber,
      ...values,
    })
    .returning();
  return row as typeof schema.taskTable.$inferSelect;
}

describe("task completion", () => {
  it("stamps completed_at in a final column and clears it on reopen", async () => {
    const { project, columns } = await setup();
    const t = await task(project.id, columns.todo.id, "to-do");
    expect(t.completedAt).toBeNull();

    const [done] = await db
      .update(schema.taskTable)
      .set({ columnId: columns.done.id, status: "done" })
      .where(eq(schema.taskTable.id, t.id))
      .returning();
    const completedAt = done?.completedAt;
    expect(completedAt).toBeInstanceOf(Date);
    // Naive UTC, like every other timestamp.
    expect(Math.abs((completedAt as Date).getTime() - Date.now())).toBeLessThan(
      60_000,
    );

    const [reopened] = await db
      .update(schema.taskTable)
      .set({ columnId: columns.inProgress.id, status: "in-progress" })
      .where(eq(schema.taskTable.id, t.id))
      .returning();
    expect(reopened?.completedAt).toBeNull();
  });
});

describe("reports", () => {
  it("counts tasks, time and overdue work for the team", async () => {
    const { owner, workspace, alice, project, columns, today } = await setup();
    await task(project.id, columns.done.id, "done", { userId: alice.id });
    await task(project.id, columns.todo.id, "to-do", {
      userId: alice.id,
      dueDate: new Date(Date.now() - 2 * 86_400_000),
      title: "Late one",
    });
    const open = await task(project.id, columns.todo.id, "to-do");
    await db.insert(schema.timeEntryTable).values({
      taskId: open.id,
      userId: alice.id,
      // Started a minute ago so it falls on today even just after midnight;
      // it counts by its recorded duration.
      startTime: new Date(Date.now() - 60_000),
      endTime: new Date(),
      duration: 3600,
    });

    const report = await requestAs(owner)(
      `/reports/summary?workspaceId=${workspace.id}&from=${today}&to=${today}`,
    );
    expect(report.status).toBe(200);
    expect(report.json.scope).toEqual({ userId: null, team: true });
    expect(report.json.tasks).toMatchObject({
      created: 3,
      completed: 1,
      open: 2,
      overdue: 1,
    });
    expect(report.json.tasks.series).toEqual([
      { day: today, created: 3, completed: 1 },
    ]);
    expect(report.json.tasks.overdueTasks[0]).toMatchObject({
      title: "Late one",
      assigneeName: "Alice",
    });
    expect(report.json.time).toMatchObject({
      trackedSeconds: 3600,
      byPerson: [{ userId: alice.id, name: "Alice", seconds: 3600 }],
    });
    expect(report.json.expenses).not.toBeNull();

    const byAlice = report.json.tasks.byPerson.find(
      (p: { userId: string | null }) => p.userId === alice.id,
    );
    expect(byAlice).toMatchObject({ open: 1, completed: 1, overdue: 1 });
  });

  it("keeps members to their own report", async () => {
    const { workspace, alice, mona, project, columns, today } = await setup();
    await task(project.id, columns.todo.id, "to-do", { userId: alice.id });
    await task(project.id, columns.todo.id, "to-do", { userId: mona.id });

    const own = await requestAs(alice)(
      `/reports/summary?workspaceId=${workspace.id}&from=${today}&to=${today}`,
    );
    expect(own.status).toBe(200);
    expect(own.json.scope).toEqual({ userId: alice.id, team: false });
    expect(own.json.tasks.open).toBe(1);
    expect(own.json.attendance.people).toHaveLength(1);

    const other = await requestAs(alice)(
      `/reports/summary?workspaceId=${workspace.id}&from=${today}&to=${today}&userId=${mona.id}`,
    );
    expect(other.status).toBe(403);

    // Managers see the team, but not HR decisions from the audit log.
    const team = await requestAs(mona)(
      `/reports/summary?workspaceId=${workspace.id}&from=${today}&to=${today}`,
    );
    expect(team.json.scope.team).toBe(true);
    expect(team.json.tasks.open).toBe(2);
  });

  it("returns an activity timeline, newest first, with task context", async () => {
    const { owner, workspace, alice, project, columns, today } = await setup();
    const t = await task(project.id, columns.todo.id, "to-do", {
      title: "Write copy",
    });
    await db.insert(schema.activityTable).values([
      {
        taskId: t.id,
        type: "created",
        userId: alice.id,
        createdAt: new Date(Date.now() - 60_000),
      },
      {
        taskId: t.id,
        type: "status_changed",
        userId: alice.id,
        eventData: { oldStatus: "to-do", newStatus: "done" },
      },
    ]);

    const feed = await requestAs(owner)(
      `/reports/activity?workspaceId=${workspace.id}&from=${today}&to=${today}`,
    );
    expect(feed.status).toBe(200);
    expect(feed.json.items.map((i: { action: string }) => i.action)).toEqual([
      "status_changed",
      "created",
    ]);
    expect(feed.json.items[0]).toMatchObject({
      source: "task",
      actorName: "Alice",
      taskTitle: "Write copy",
      projectName: "Website",
    });
  });

  it("refuses ranges that end first or run past a year", async () => {
    const { owner, workspace } = await setup();
    const backwards = await requestAs(owner)(
      `/reports/summary?workspaceId=${workspace.id}&from=2026-09-10&to=2026-09-01`,
    );
    expect(backwards.status).toBe(400);
    const tooLong = await requestAs(owner)(
      `/reports/summary?workspaceId=${workspace.id}&from=2024-01-01&to=2026-01-01`,
    );
    expect(tooLong.status).toBe(400);
  });
});

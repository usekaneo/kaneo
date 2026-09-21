import { readFileSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { subscribeToEvent } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function seedTasksFor(workspaceId: string, count: number) {
  const { project, columns } = await createProjectFixture({ workspaceId });
  const tasks: (typeof schema.taskTable.$inferSelect)[] = [];
  for (let i = 0; i < count; i += 1) {
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: `Tracked task ${i + 1}`,
        description: "",
        priority: "low",
        status: "to-do",
        columnId: columns.todo?.id ?? null,
        number: i + 1,
        position: i + 1,
      })
      .returning();
    tasks.push(task);
  }
  return { project, tasks };
}

async function addWorkspaceMember(
  workspaceId: string,
  userName: string,
  role = "member",
) {
  const { user } = await createWorkspaceMember({ userName });
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: user.id,
    role,
    joinedAt: new Date(),
  });
  return user;
}

async function postJson(
  app: ReturnType<typeof createApp>["app"],
  path: string,
  body: unknown,
  method = "POST",
) {
  return app.request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await resetTestDatabase();
});

describe("active time tracking", () => {
  it("starts a running entry stamped by the server clock", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { tasks } = await seedTasksFor(workspace.id, 1);

    mockAuthenticatedSession(user);
    const { app } = createApp();
    const before = Date.now();

    const response = await postJson(app, "/api/time-entry/start", {
      taskId: tasks[0].id,
    });

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.entry.endTime).toBeNull();
    expect(result.entry.duration).toBeNull();
    expect(result.entry.billable).toBe(true);
    expect(result.stoppedEntryId).toBeNull();
    expect(result.discardedEntryId).toBeNull();

    const startTime = new Date(result.entry.startTime).getTime();
    expect(startTime).toBeGreaterThanOrEqual(before - 5000);
    expect(startTime).toBeLessThanOrEqual(Date.now() + 5000);
  });

  it("returns the existing entry when starting twice on the same task", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { tasks } = await seedTasksFor(workspace.id, 1);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const first = await (
      await postJson(app, "/api/time-entry/start", { taskId: tasks[0].id })
    ).json();
    const second = await (
      await postJson(app, "/api/time-entry/start", { taskId: tasks[0].id })
    ).json();

    expect(second.entry.id).toBe(first.entry.id);
    expect(second.stoppedEntryId).toBeNull();
  });

  it("auto-stops the previous timer when switching tasks", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { tasks } = await seedTasksFor(workspace.id, 2);

    // A running entry old enough to keep.
    const [oldRunning] = await db
      .insert(schema.timeEntryTable)
      .values({
        taskId: tasks[0].id,
        userId: user.id,
        description: "",
        billable: true,
        startTime: new Date(Date.now() - 3600_000),
        endTime: null,
        duration: null,
      })
      .returning();

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await postJson(app, "/api/time-entry/start", {
      taskId: tasks[1].id,
    });

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.entry.taskId).toBe(tasks[1].id);
    expect(result.stoppedEntryId).toBe(oldRunning.id);

    const [stopped] = await db
      .select()
      .from(schema.timeEntryTable)
      .where(eq(schema.timeEntryTable.id, oldRunning.id));
    expect(stopped.endTime).not.toBeNull();
    expect(stopped.duration).toBeGreaterThanOrEqual(3599);

    // Exactly one activity row for the completed session.
    const activities = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, tasks[0].id));
    expect(activities).toHaveLength(1);
    expect(activities[0].type).toBe("time_tracked");
    expect(
      (activities[0].eventData as { timeEntryId: string }).timeEntryId,
    ).toBe(oldRunning.id);

    // Starting wrote no activity row of its own.
    const startedActivities = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, tasks[1].id));
    expect(startedActivities).toHaveLength(0);
  });

  it("discards an auto-stopped timer younger than 3 seconds", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { tasks } = await seedTasksFor(workspace.id, 2);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const first = await (
      await postJson(app, "/api/time-entry/start", { taskId: tasks[0].id })
    ).json();
    const second = await (
      await postJson(app, "/api/time-entry/start", { taskId: tasks[1].id })
    ).json();

    expect(second.discardedEntryId).toBe(first.entry.id);
    expect(second.stoppedEntryId).toBeNull();

    const leftover = await db
      .select()
      .from(schema.timeEntryTable)
      .where(eq(schema.timeEntryTable.id, first.entry.id));
    expect(leftover).toHaveLength(0);

    const activities = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, tasks[0].id));
    expect(activities).toHaveLength(0);
  });

  it("stops the caller's timer on a task, then reports nothing running", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { tasks } = await seedTasksFor(workspace.id, 1);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    await postJson(app, "/api/time-entry/start", { taskId: tasks[0].id });

    const stopResponse = await app.request(
      `/api/time-entry/task/${tasks[0].id}/stop`,
      { method: "POST" },
    );
    expect(stopResponse.status).toBe(200);
    const stopped = await stopResponse.json();
    expect(stopped.endTime).not.toBeNull();
    expect(stopped.duration).not.toBeNull();

    const repeatResponse = await app.request(
      `/api/time-entry/task/${tasks[0].id}/stop`,
      { method: "POST" },
    );
    expect(repeatResponse.status).toBe(404);
  });

  it("returns 404 when stopping with nothing running", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { tasks } = await seedTasksFor(workspace.id, 1);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request(
      `/api/time-entry/task/${tasks[0].id}/stop`,
      { method: "POST" },
    );
    expect(response.status).toBe(404);
  });

  it("isolates running timers between users on the same task", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const otherUser = await addWorkspaceMember(workspace.id, "Second User");
    const { tasks } = await seedTasksFor(workspace.id, 1);

    mockAuthenticatedSession(user);
    const { app } = createApp();
    await postJson(app, "/api/time-entry/start", { taskId: tasks[0].id });

    // Another user's stop only ever addresses their own clock.
    mockAuthenticatedSession(otherUser);
    const response = await app.request(
      `/api/time-entry/task/${tasks[0].id}/stop`,
      { method: "POST" },
    );
    expect(response.status).toBe(404);

    // The first user's timer is untouched.
    mockAuthenticatedSession(user);
    const runningResponse = await app.request("/api/time-entry/running/me");
    expect(runningResponse.status).toBe(200);
    expect((await runningResponse.json())?.taskId).toBe(tasks[0].id);
  });

  it("reports the running entry with navigation context", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { project, tasks } = await seedTasksFor(workspace.id, 1);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const emptyResponse = await app.request("/api/time-entry/running/me");
    expect(emptyResponse.status).toBe(200);
    expect(await emptyResponse.json()).toBeNull();

    await postJson(app, "/api/time-entry/start", { taskId: tasks[0].id });

    const response = await app.request("/api/time-entry/running/me");
    expect(response.status).toBe(200);
    const running = await response.json();
    expect(running.taskId).toBe(tasks[0].id);
    expect(running.taskTitle).toBe(tasks[0].title);
    expect(running.projectId).toBe(project.id);
    expect(running.workspaceId).toBe(workspace.id);
  });

  it("derives the end time from a duration edit", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { tasks } = await seedTasksFor(workspace.id, 1);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const created = await (
      await postJson(app, "/api/time-entry", {
        taskId: tasks[0].id,
        startTime: new Date("2026-01-01T09:00:00.000Z").toISOString(),
        endTime: new Date("2026-01-01T10:00:00.000Z").toISOString(),
      })
    ).json();

    const response = await app.request(`/api/time-entry/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duration: 1800, billable: false }),
    });

    expect(response.status).toBe(200);
    const updated = await response.json();
    expect(updated.duration).toBe(1800);
    expect(updated.billable).toBe(false);
    expect(new Date(updated.endTime).toISOString()).toBe(
      "2026-01-01T09:30:00.000Z",
    );
  });

  it("deletes an ended entry with its activity row, and refuses running ones", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { tasks } = await seedTasksFor(workspace.id, 1);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    await postJson(app, "/api/time-entry/start", { taskId: tasks[0].id });
    const running = await (
      await app.request("/api/time-entry/running/me")
    ).json();

    const runningDelete = await app.request(`/api/time-entry/${running.id}`, {
      method: "DELETE",
    });
    expect(runningDelete.status).toBe(409);

    await app.request(`/api/time-entry/task/${tasks[0].id}/stop`, {
      method: "POST",
    });

    const entries = await (
      await app.request(`/api/time-entry/task/${tasks[0].id}`)
    ).json();
    expect(entries).toHaveLength(1);
    expect(entries[0].billable).toBe(true);

    const deleteResponse = await app.request(
      `/api/time-entry/${entries[0].id}`,
      { method: "DELETE" },
    );
    expect(deleteResponse.status).toBe(200);

    const remaining = await db
      .select()
      .from(schema.timeEntryTable)
      .where(eq(schema.timeEntryTable.id, entries[0].id));
    expect(remaining).toHaveLength(0);

    const activities = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, tasks[0].id));
    expect(activities).toHaveLength(0);
  });

  it("rejects open entries on the manual path while a timer runs", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { tasks } = await seedTasksFor(workspace.id, 1);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    await postJson(app, "/api/time-entry/start", { taskId: tasks[0].id });

    const response = await postJson(app, "/api/time-entry", {
      taskId: tasks[0].id,
      startTime: new Date("2026-01-01T09:00:00.000Z").toISOString(),
    });

    expect(response.status).toBe(400);
  });

  it("returns 404 instead of an unrelated ended entry", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { tasks } = await seedTasksFor(workspace.id, 1);

    await db.insert(schema.timeEntryTable).values({
      taskId: tasks[0].id,
      userId: user.id,
      description: "",
      billable: true,
      startTime: new Date(Date.now() - 7200_000),
      endTime: new Date(Date.now() - 3600_000),
      duration: 3600,
    });

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request(
      `/api/time-entry/task/${tasks[0].id}/stop`,
      { method: "POST" },
    );
    expect(response.status).toBe(404);
  });

  it("syncs the activity snapshot when an entry is edited", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { tasks } = await seedTasksFor(workspace.id, 1);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const created = await (
      await postJson(app, "/api/time-entry", {
        taskId: tasks[0].id,
        startTime: new Date("2026-01-01T09:00:00.000Z").toISOString(),
        endTime: new Date("2026-01-01T10:00:00.000Z").toISOString(),
      })
    ).json();

    await app.request(`/api/time-entry/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duration: 1800 }),
    });

    const activities = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, tasks[0].id));
    expect(activities).toHaveLength(1);
    expect(activities[0].eventData).toMatchObject({
      timeEntryId: created.id,
      duration: 1800,
    });
  });

  it("announces a start for realtime only, with no activity row", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { project, tasks } = await seedTasksFor(workspace.id, 1);

    const seen: Array<Record<string, unknown>> = [];
    await subscribeToEvent("time-entry.started", async (data) => {
      seen.push(data as Record<string, unknown>);
    });

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await postJson(app, "/api/time-entry/start", {
      taskId: tasks[0].id,
    });
    expect(response.status).toBe(200);
    const result = await response.json();

    const announcement = seen.find((event) => event.taskId === tasks[0].id);
    expect(announcement).toMatchObject({
      timeEntryId: result.entry.id,
      taskId: tasks[0].id,
      userId: user.id,
      projectId: project.id,
    });

    const activities = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, tasks[0].id));
    expect(activities).toHaveLength(0);
  });

  it("announces running-entry note edits for realtime only", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { project, tasks } = await seedTasksFor(workspace.id, 1);

    const seen: Array<Record<string, unknown>> = [];
    await subscribeToEvent("time-entry.updated", async (data) => {
      seen.push(data as Record<string, unknown>);
    });

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const started = await (
      await postJson(app, "/api/time-entry/start", { taskId: tasks[0].id })
    ).json();

    const response = await app.request(`/api/time-entry/${started.entry.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "still working" }),
    });
    expect(response.status).toBe(200);

    const announcement = seen.find(
      (event) => event.timeEntryId === started.entry.id,
    );
    expect(announcement).toMatchObject({
      taskId: tasks[0].id,
      userId: user.id,
      projectId: project.id,
    });

    const activities = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, tasks[0].id));
    expect(activities).toHaveLength(0);
  });

  it("clears the description when set to empty", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { tasks } = await seedTasksFor(workspace.id, 1);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const created = await (
      await postJson(app, "/api/time-entry", {
        taskId: tasks[0].id,
        startTime: new Date("2026-01-01T09:00:00.000Z").toISOString(),
        endTime: new Date("2026-01-01T10:00:00.000Z").toISOString(),
        description: "has notes",
      })
    ).json();
    expect(created.description).toBe("has notes");

    const response = await app.request(`/api/time-entry/${created.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "" }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).description).toBe("");
  });

  it("runs the shipped 0046 cleanup before the running index", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { tasks } = await seedTasksFor(workspace.id, 2);

    // Simulate an unmigrated install: drop the index so the legacy
    // duplicate open rows can exist at all.
    await db.execute(
      sql.raw("DROP INDEX IF EXISTS time_entry_running_user_unique"),
    );

    const older = new Date(Date.now() - 7200_000);
    const newer = new Date(Date.now() - 3600_000);
    await db.insert(schema.timeEntryTable).values([
      {
        taskId: tasks[0].id,
        userId: user.id,
        description: "",
        startTime: older,
        endTime: null,
        duration: null,
      },
      {
        taskId: tasks[1].id,
        userId: user.id,
        description: "",
        startTime: newer,
        endTime: null,
        duration: null,
      },
    ]);

    const file = new URL(
      "../../apps/api/drizzle/0046_demonic_ego.sql",
      import.meta.url,
    );
    const statements = readFileSync(file, "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    // The artifact under test is the cleanup statement that must run first.
    const cleanup = statements.find((statement) =>
      statement.includes("older_time_entry"),
    );
    const createIndex = statements.find((statement) =>
      statement.includes("CREATE UNIQUE INDEX"),
    );
    expect(cleanup).toBeDefined();
    expect(createIndex).toBeDefined();
    await db.execute(sql.raw(cleanup as string));
    // An upgraded install creates the index right after: it must succeed.
    await db.execute(sql.raw(createIndex as string));

    const rows = await db
      .select()
      .from(schema.timeEntryTable)
      .where(eq(schema.timeEntryTable.userId, user.id));
    const stillRunning = rows.filter((row) => row.endTime === null);
    expect(stillRunning).toHaveLength(1);
    expect(stillRunning[0].taskId).toBe(tasks[1].id);
    expect(
      rows.find((row) => row.taskId === tasks[0].id)?.endTime,
    ).not.toBeNull();

    const indexes = await db.execute<{ indexname: string }>(
      sql`SELECT indexname FROM pg_indexes WHERE tablename = 'time_entry'`,
    );
    expect(indexes.rows.map((row) => row.indexname)).toContain(
      "time_entry_running_user_unique",
    );
  });

  it("serializes concurrent starts onto one running entry", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { tasks } = await seedTasksFor(workspace.id, 1);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        postJson(app, "/api/time-entry/start", { taskId: tasks[0].id }),
      ),
    );

    for (const response of results) {
      expect(response.status).toBe(200);
    }
    const ids = await Promise.all(
      results.map(async (response) => (await response.json()).entry.id),
    );
    expect(new Set(ids).size).toBe(1);

    const rows = await db
      .select()
      .from(schema.timeEntryTable)
      .where(eq(schema.timeEntryTable.userId, user.id));
    expect(rows.filter((row) => row.endTime === null)).toHaveLength(1);
  });

  it("lets a removed member stop their own running timer", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { tasks } = await seedTasksFor(workspace.id, 1);
    const [running] = await db
      .insert(schema.timeEntryTable)
      .values({
        taskId: tasks[0].id,
        userId: user.id,
        description: "",
        billable: true,
        startTime: new Date(Date.now() - 30_000),
        endTime: null,
        duration: null,
      })
      .returning();

    await db
      .delete(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.workspaceId, workspace.id),
          eq(schema.workspaceUserTable.userId, user.id),
        ),
      );

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request(
      `/api/time-entry/task/${tasks[0].id}/stop`,
      { method: "POST" },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).id).toBe(running.id);
  });

  it("does not let another user stop a running timer", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const outsider = await addWorkspaceMember(workspace.id, "Outsider");
    const { tasks } = await seedTasksFor(workspace.id, 1);

    await db.insert(schema.timeEntryTable).values({
      taskId: tasks[0].id,
      userId: user.id,
      description: "",
      billable: true,
      startTime: new Date(Date.now() - 30_000),
      endTime: null,
      duration: null,
    });

    mockAuthenticatedSession(outsider);
    const { app } = createApp();

    const response = await app.request(
      `/api/time-entry/task/${tasks[0].id}/stop`,
      { method: "POST" },
    );
    expect(response.status).toBe(404);
  });

  it("announces both tasks on a discarded switch", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { tasks } = await seedTasksFor(workspace.id, 2);

    const started: Array<Record<string, unknown>> = [];
    const discarded: Array<Record<string, unknown>> = [];
    await subscribeToEvent("time-entry.started", async (data) => {
      started.push(data as Record<string, unknown>);
    });
    await subscribeToEvent("time-entry.deleted", async (data) => {
      discarded.push(data as Record<string, unknown>);
    });

    mockAuthenticatedSession(user);
    const { app } = createApp();

    await postJson(app, "/api/time-entry/start", { taskId: tasks[0].id });
    await postJson(app, "/api/time-entry/start", { taskId: tasks[1].id });

    const announcement = started.find((event) => event.taskId === tasks[1].id);
    expect(announcement).toBeDefined();
    expect(announcement?.userId).toBe(user.id);
    expect(discarded).toEqual([
      expect.objectContaining({
        taskId: tasks[0].id,
        userId: user.id,
        type: "delete",
      }),
    ]);
  });

  it("ignores a fresh manual entry on stop", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { tasks } = await seedTasksFor(workspace.id, 1);

    const now = Date.now();
    await db.insert(schema.timeEntryTable).values({
      taskId: tasks[0].id,
      userId: user.id,
      description: "",
      billable: true,
      startTime: new Date(now - 30_000),
      endTime: new Date(now),
      duration: 30,
    });

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request(
      `/api/time-entry/task/${tasks[0].id}/stop`,
      { method: "POST" },
    );
    expect(response.status).toBe(404);
  });

  it("requires task:update to track time", async () => {
    const { workspace } = await createWorkspaceMember({ role: "owner" });
    const viewer = await addWorkspaceMember(workspace.id, "Viewer", "viewer");
    const { tasks } = await seedTasksFor(workspace.id, 1);

    mockAuthenticatedSession(viewer);
    const { app } = createApp();

    const response = await postJson(app, "/api/time-entry/start", {
      taskId: tasks[0].id,
    });
    expect(response.status).toBe(403);
  });
});

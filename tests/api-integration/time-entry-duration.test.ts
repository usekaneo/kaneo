import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function seedTaskFor(workspaceId: string) {
  const { project, columns } = await createProjectFixture({ workspaceId });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Tracked task",
      description: "",
      priority: "low",
      status: "to-do",
      columnId: columns.todo?.id ?? null,
      number: 1,
      position: 1,
    })
    .returning();
  return task;
}

// Runs the shipped migration rather than a copy of its SQL, so the test covers
// the artifact that actually reaches an upgraded installation.
async function runDurationBackfillMigration() {
  const file = new URL(
    "../../apps/api/drizzle/0043_backfill_time_entry_durations.sql",
    import.meta.url,
  );
  const statements = readFileSync(file, "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }
}

beforeEach(async () => {
  await resetTestDatabase();
});

describe("time entry duration", () => {
  it("records elapsed seconds when the entry is created already closed", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const startTime = new Date("2026-01-01T09:00:00.000Z");
    const endTime = new Date("2026-01-01T10:30:00.000Z");

    const response = await app.request("/api/time-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      }),
    });

    expect(response.status).toBe(200);
    const entry = await response.json();
    expect(entry.duration).toBe(5400);
  });

  it("leaves duration unset while the entry is still running", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/time-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        startTime: new Date("2026-01-01T09:00:00.000Z").toISOString(),
      }),
    });

    expect(response.status).toBe(200);
    const entry = await response.json();
    expect(entry.duration).toBeNull();
  });
});

describe("global search", () => {
  it("rejects a search with no workspace", async () => {
    const { user } = await createWorkspaceMember({ role: "owner" });

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/search?q=anything");

    expect(response.status).toBe(400);
  });
});

describe("time entry duration backfill", () => {
  it("recomputes closed entries that were written with zero", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    const [entry] = await db
      .insert(schema.timeEntryTable)
      .values({
        taskId: task.id,
        userId: user.id,
        description: "",
        startTime: new Date("2026-01-01T09:00:00.000Z"),
        endTime: new Date("2026-01-01T10:30:00.000Z"),
        duration: 0,
      })
      .returning();

    await runDurationBackfillMigration();

    const [repaired] = await db
      .select()
      .from(schema.timeEntryTable)
      .where(eq(schema.timeEntryTable.id, entry.id));

    expect(repaired.duration).toBe(5400);
  });

  it("clears the zero duration on entries that are still running", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    const [entry] = await db
      .insert(schema.timeEntryTable)
      .values({
        taskId: task.id,
        userId: user.id,
        description: "",
        startTime: new Date("2026-01-01T09:00:00.000Z"),
        endTime: null,
        duration: 0,
      })
      .returning();

    await runDurationBackfillMigration();

    const [repaired] = await db
      .select()
      .from(schema.timeEntryTable)
      .where(eq(schema.timeEntryTable.id, entry.id));

    expect(repaired.duration).toBeNull();
  });

  it("leaves an already correct entry alone", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    const [entry] = await db
      .insert(schema.timeEntryTable)
      .values({
        taskId: task.id,
        userId: user.id,
        description: "",
        startTime: new Date("2026-01-01T09:00:00.000Z"),
        endTime: new Date("2026-01-01T09:30:00.000Z"),
        duration: 1800,
      })
      .returning();

    await runDurationBackfillMigration();

    const [after] = await db
      .select()
      .from(schema.timeEntryTable)
      .where(eq(schema.timeEntryTable.id, entry.id));

    expect(after.duration).toBe(1800);
  });
});

describe("time entry validation", () => {
  it("rejects an end time before the start time", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/time-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        startTime: new Date("2026-01-01T10:00:00.000Z").toISOString(),
        endTime: new Date("2026-01-01T09:00:00.000Z").toISOString(),
      }),
    });

    expect(response.status).toBe(400);
  });
});

describe("time entry timestamp validation", () => {
  it("rejects an unparseable start time", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/time-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, startTime: "not-a-date" }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects a calendar-invalid date instead of rolling it forward", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/time-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        startTime: "2026-02-30T10:00:00Z",
      }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects a non-ISO date format", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/time-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, startTime: "01/02/2026" }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects an unparseable end time", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/time-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        startTime: new Date("2026-01-01T09:00:00.000Z").toISOString(),
        endTime: "garbage",
      }),
    });

    expect(response.status).toBe(400);
  });
});

describe("time entry duration limits", () => {
  it("rejects a span that would overflow the duration column", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    mockAuthenticatedSession(user);
    const { app } = createApp();

    const response = await app.request("/api/time-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        startTime: "1900-01-01T00:00:00.000Z",
        endTime: "2026-01-01T00:00:00.000Z",
      }),
    });

    expect(response.status).toBe(400);
  });
});

describe("backfill tolerates legacy rows the API would now reject", () => {
  it("leaves an oversized legacy span alone rather than failing the migration", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    const [entry] = await db
      .insert(schema.timeEntryTable)
      .values({
        taskId: task.id,
        userId: user.id,
        description: "",
        startTime: new Date("1900-01-01T00:00:00.000Z"),
        endTime: new Date("2026-01-01T00:00:00.000Z"),
        duration: 0,
      })
      .returning();

    await runDurationBackfillMigration();

    const [after] = await db
      .select()
      .from(schema.timeEntryTable)
      .where(eq(schema.timeEntryTable.id, entry.id));

    expect(after.duration).toBe(0);
  });
});

describe("backfill repairs every invalid legacy state", () => {
  it("sets a zero-length closed entry to 0 rather than leaving it null", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);
    const at = new Date("2026-01-01T09:00:00.000Z");

    const [entry] = await db
      .insert(schema.timeEntryTable)
      .values({
        taskId: task.id,
        userId: user.id,
        description: "",
        startTime: at,
        endTime: at,
        duration: null,
      })
      .returning();

    await runDurationBackfillMigration();

    const [after] = await db
      .select()
      .from(schema.timeEntryTable)
      .where(eq(schema.timeEntryTable.id, entry.id));

    expect(after.duration).toBe(0);
  });

  it("clears a non-zero duration on an entry that is still running", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const task = await seedTaskFor(workspace.id);

    const [entry] = await db
      .insert(schema.timeEntryTable)
      .values({
        taskId: task.id,
        userId: user.id,
        description: "",
        startTime: new Date("2026-01-01T09:00:00.000Z"),
        endTime: null,
        duration: 999,
      })
      .returning();

    await runDurationBackfillMigration();

    const [after] = await db
      .select()
      .from(schema.timeEntryTable)
      .where(eq(schema.timeEntryTable.id, entry.id));

    expect(after.duration).toBeNull();
  });
});

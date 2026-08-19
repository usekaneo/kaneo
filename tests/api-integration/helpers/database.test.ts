import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../../apps/api/src/database";
import {
  mcpOauthStateTable,
  taskReminderSentTable,
} from "../../../apps/api/src/database/schema";
import { resetTestDatabase } from "./database";

async function seedMcpOauthStateRow(): Promise<string> {
  const id = `mcp-oauth-${randomUUID()}`;
  await db.insert(mcpOauthStateTable).values({
    id,
    kind: "test",
    key: `key-${randomUUID()}`,
    payload: {},
    expiresAt: new Date(Date.now() + 60_000),
  });
  return id;
}

async function seedTaskReminderSentRow(): Promise<string> {
  const userId = `user-${randomUUID()}`;
  const workspaceId = `workspace-${randomUUID()}`;
  const projectId = `project-${randomUUID()}`;
  const columnId = `column-${randomUUID()}`;
  const taskId = `task-${randomUUID()}`;
  const id = `task-reminder-${randomUUID()}`;

  await db.insert(schema.userTable).values({
    id: userId,
    email: `${userId}@example.com`,
    emailVerified: true,
    name: "Reminder Test User",
  });
  await db.insert(schema.workspaceTable).values({
    id: workspaceId,
    createdAt: new Date(),
    name: "Reminder Workspace",
    slug: `workspace-${randomUUID()}`,
  });
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId,
    role: "admin",
    joinedAt: new Date(),
  });
  await db.insert(schema.projectTable).values({
    id: projectId,
    workspaceId,
    name: "Reminder Project",
    icon: "Folder",
    slug: `project-${randomUUID()}`,
  });
  await db.insert(schema.columnTable).values({
    id: columnId,
    projectId,
    name: "To do",
    slug: "to-do",
    position: 1,
    isFinal: false,
  });
  await db.insert(schema.taskTable).values({
    id: taskId,
    projectId,
    title: "Reminder task",
    description: "",
    priority: "low",
    status: "to-do",
    columnId,
    number: 1,
    position: 1,
  });
  await db.insert(taskReminderSentTable).values({
    id,
    taskId,
    reminderType: "due-soon",
  });

  return id;
}

async function rowExists(tableName: string, id: string): Promise<boolean> {
  const result = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM ${sql.raw(`"${tableName}"`)}
      WHERE id = ${id}
    ) AS exists
  `);
  return result.rows[0]?.exists === true;
}

describe("resetTestDatabase", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterEach(async () => {
    await resetTestDatabase();
  });

  it("truncates mcp_oauth_state rows", async () => {
    const id = await seedMcpOauthStateRow();
    expect(await rowExists("mcp_oauth_state", id)).toBe(true);

    await resetTestDatabase();

    expect(await rowExists("mcp_oauth_state", id)).toBe(false);
  });

  it("truncates task_reminder_sent rows", async () => {
    const id = await seedTaskReminderSentRow();
    expect(await rowExists("task_reminder_sent", id)).toBe(true);

    await resetTestDatabase();

    expect(await rowExists("task_reminder_sent", id)).toBe(false);
  });
});

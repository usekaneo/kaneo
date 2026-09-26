import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import getTasks from "../../apps/api/src/task/controllers/get-tasks";
import { boardTaskSchema } from "../../apps/api/src/task/response";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const m = vi.hoisted(() => ({ publish: vi.fn(async () => undefined) }));
vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<object>()),
  publishEvent: m.publish,
}));
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});
async function context(role = "member") {
  const member = await createWorkspaceMember({ role });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, title: "Task", number: 1 })
    .returning();
  return { ...member, project, task };
}
function request(path: string, method: string, body?: unknown) {
  return createApp().app.request(`/api/external-link/task${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
}
async function link(
  taskId: string,
  integrationId: string | null = null,
  resourceType = "url",
) {
  const [entry] = await db
    .insert(schema.externalLinkTable)
    .values({
      taskId,
      integrationId,
      resourceType,
      externalId: "resource",
      url: "https://example.com/resource",
    })
    .returning();
  return entry;
}

describe("manual external resource links", () => {
  it("upgrades an existing integration link without changing it", async () => {
    const own = await context();
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({ projectId: own.project.id, type: "github", config: "{}" })
      .returning();
    const existing = await link(own.task.id, integration.id, "issue");
    const migration = readFileSync(
      new URL(
        "../../apps/api/drizzle/0051_modern_corsair.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`ALTER TABLE external_link ALTER COLUMN integration_id SET NOT NULL`,
      );
      await tx.execute(sql.raw(migration));
      expect(await tx.query.externalLinkTable.findMany()).toEqual([existing]);
      const [manual] = await tx
        .insert(schema.externalLinkTable)
        .values({
          taskId: own.task.id,
          integrationId: null,
          resourceType: "url",
          externalId: "manual",
          url: "https://example.com/manual",
        })
        .returning();
      expect(manual.integrationId).toBeNull();
    });
  });

  it("creates, lists and removes a manual link and publishes both updates", async () => {
    const own = await context();
    mockAuthenticatedSession(own.user);
    const created = await request(`/${own.task.id}`, "POST", {
      url: "https://example.com/design",
      title: "Design",
    });
    expect(created.status).toBe(200);
    const entry = (await created.json()) as { id: string };
    const board = await getTasks(own.project.id);
    const tasks = [
      ...board.data.columns.flatMap((column) => column.tasks),
      ...board.data.plannedTasks,
      ...board.data.archivedTasks,
    ];
    const boardTask = tasks.find((task) => task.id === own.task.id);
    expect(boardTask?.externalLinks).toMatchObject([
      { id: entry.id, integrationId: null },
    ]);
    expect(boardTaskSchema.safeParse(boardTask).success).toBe(true);
    const listed = await request(`/${own.task.id}`, "GET");
    expect(await listed.json()).toMatchObject([
      { id: entry.id, integrationId: null, integration: null, title: "Design" },
    ]);
    expect(
      (await request(`/${own.task.id}/${entry.id}`, "DELETE")).status,
    ).toBe(200);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
    expect(m.publish).toHaveBeenCalledTimes(2);
    expect(m.publish).toHaveBeenLastCalledWith(
      "task.updated",
      expect.objectContaining({
        taskId: own.task.id,
        projectId: own.project.id,
        userId: own.user.id,
      }),
    );
    expect(
      (await request(`/${own.task.id}/${entry.id}`, "DELETE")).status,
    ).toBe(404);
    expect(m.publish).toHaveBeenCalledTimes(2);
  });

  it("requires authentication for creation and removal", async () => {
    const own = await context();
    const entry = await link(own.task.id);
    mockAnonymousSession();
    expect(
      (await request(`/${own.task.id}`, "POST", { url: "https://example.com" }))
        .status,
    ).toBe(401);
    expect(
      (await request(`/${own.task.id}/${entry.id}`, "DELETE")).status,
    ).toBe(401);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(1);
  });

  it("allows viewers to read but not create or remove links", async () => {
    const own = await context("viewer");
    const entry = await link(own.task.id);
    mockAuthenticatedSession(own.user);
    expect((await request(`/${own.task.id}`, "GET")).status).toBe(200);
    expect(
      (await request(`/${own.task.id}`, "POST", { url: "https://example.com" }))
        .status,
    ).toBe(403);
    expect(
      (await request(`/${own.task.id}/${entry.id}`, "DELETE")).status,
    ).toBe(403);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(1);
    expect(m.publish).not.toHaveBeenCalled();
  });

  it("rejects foreign workspace access and an authorized task paired with a foreign link", async () => {
    const own = await context();
    const other = await context();
    const entry = await link(other.task.id);
    mockAuthenticatedSession(own.user);
    expect(
      (
        await request(`/${other.task.id}`, "POST", {
          url: "https://example.com",
        })
      ).status,
    ).toBe(403);
    expect(
      (await request(`/${other.task.id}/${entry.id}`, "DELETE")).status,
    ).toBe(403);
    expect(
      (await request(`/${own.task.id}/${entry.id}`, "DELETE")).status,
    ).toBe(404);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(1);
    expect(m.publish).not.toHaveBeenCalled();
  });

  it("does not remove another task's link in the same workspace", async () => {
    const own = await context();
    const [other] = await db
      .insert(schema.taskTable)
      .values({ projectId: own.project.id, title: "Other", number: 2 })
      .returning();
    const entry = await link(other.id);
    mockAuthenticatedSession(own.user);
    expect(
      (await request(`/${own.task.id}/${entry.id}`, "DELETE")).status,
    ).toBe(404);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(1);
  });

  it("preserves provider-managed and non-URL links", async () => {
    const own = await context();
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({ projectId: own.project.id, type: "github", config: "{}" })
      .returning();
    const entries = [
      await link(own.task.id, integration.id),
      await link(own.task.id, null, "issue"),
    ];
    mockAuthenticatedSession(own.user);
    for (const entry of entries)
      expect(
        (await request(`/${own.task.id}/${entry.id}`, "DELETE")).status,
      ).toBe(404);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(2);
    expect(m.publish).not.toHaveBeenCalled();
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,hello",
    "ftp://example.com/file",
  ])("rejects unsafe URL %s", async (url) => {
    const own = await context();
    mockAuthenticatedSession(own.user);
    expect((await request(`/${own.task.id}`, "POST", { url })).status).toBe(
      400,
    );
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
    expect(m.publish).not.toHaveBeenCalled();
  });
});

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);

async function fixture(type = "multiselect", role = "admin") {
  const member = await createWorkspaceMember({ role });
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [field] = await db
    .insert(schema.customFieldDefinitionTable)
    .values({
      projectId: project.id,
      name: "People",
      type,
      options: ["Alice", "Bob", "Unused"],
      defaultValue: type === "multiselect" ? '["Alice"]' : "Alice",
      required: false,
    })
    .returning();
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Assigned task",
      number: 1,
      status: "to-do",
      columnId: columns.todo.id,
    })
    .returning();
  await db.insert(schema.customFieldValueTable).values({
    taskId: task.id,
    fieldId: field.id,
    value: type === "multiselect" ? '["Alice","Bob"]' : "Alice",
  });
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const update = (body: Record<string, unknown> = {}) =>
    app.request(`/api/custom-field/${field.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Attendees",
        updatedAt: field.updatedAt.toISOString(),
        ...body,
      }),
    });
  const readValue = async () =>
    (
      await db
        .select()
        .from(schema.customFieldValueTable)
        .where(eq(schema.customFieldValueTable.fieldId, field.id))
    )[0]?.value;
  return { app, field, update, readValue, project, task, member };
}

describe("custom field editing", () => {
  it.each(["dropdown", "multiselect"])(
    "renames %s selections and defaults together, and adds/removes unused options",
    async (type) => {
      const { update, readValue, app, project } = await fixture(type);
      const response = await update({
        options: [
          { originalValue: "Alice", value: "Alex" },
          { originalValue: "Bob", value: "Robert" },
          { value: "New person" },
        ],
      });
      expect(response.status, await response.clone().text()).toBe(200);
      expect(await response.json()).toMatchObject({
        name: "Attendees",
        options: ["Alex", "Robert", "New person"],
        defaultValue: type === "multiselect" ? '["Alex"]' : "Alex",
        type,
        required: false,
      });
      expect(await readValue()).toBe(
        type === "multiselect" ? '["Alex","Robert"]' : "Alex",
      );
      const filters = await app.request(
        `/api/custom-field/project/${project.id}/filter-values`,
      );
      expect(await filters.text()).toContain("Alex");
    },
  );

  it("handles simultaneous swaps without collapsing selections", async () => {
    const { update, readValue } = await fixture();
    expect(
      (
        await update({
          options: [
            { originalValue: "Alice", value: "Bob" },
            { originalValue: "Bob", value: "Alice" },
          ],
        })
      ).status,
    ).toBe(200);
    expect(await readValue()).toBe('["Bob","Alice"]');
  });

  it("rolls back when removing an option used by a task", async () => {
    const { update, readValue, field } = await fixture();
    expect(
      (
        await update({
          options: [
            { originalValue: "Alice", value: "Alex" },
            { value: "New" },
          ],
        })
      ).status,
    ).toBe(400);
    expect(await readValue()).toBe('["Alice","Bob"]');
    expect(
      (
        await db
          .select()
          .from(schema.customFieldDefinitionTable)
          .where(eq(schema.customFieldDefinitionTable.id, field.id))
      )[0]?.name,
    ).toBe("People");
  });

  it("protects a default even when no tasks use it", async () => {
    const { update, field } = await fixture();
    await db
      .delete(schema.customFieldValueTable)
      .where(eq(schema.customFieldValueTable.fieldId, field.id));
    expect(
      (
        await update({
          options: [{ originalValue: "Bob", value: "Bob" }, { value: "New" }],
        })
      ).status,
    ).toBe(400);
  });

  it.each([
    { name: " " },
    { type: "text" },
    { options: [{ originalValue: "Missing", value: "A" }, { value: "B" }] },
    {
      options: [
        { originalValue: "Alice", value: "A" },
        { originalValue: "Alice", value: "B" },
      ],
    },
    {
      options: [
        { originalValue: "Alice", value: "Same" },
        { originalValue: "Bob", value: " Same " },
      ],
    },
    { options: [{ value: " " }, { value: "B" }] },
    { options: [] },
  ])("rejects invalid edits %j", async (body) => {
    const { update } = await fixture();
    expect((await update(body)).status).toBe(400);
  });

  it("renames text fields without changing their values or settings", async () => {
    const { update, readValue } = await fixture("text");
    expect((await update()).status).toBe(200);
    expect(await readValue()).toBe("Alice");
  });

  it("rejects stale edits", async () => {
    const { update } = await fixture();
    expect((await update()).status).toBe(200);
    expect((await update({ name: "Stale" })).status).toBe(409);
  });

  it("validates future writes against the renamed options", async () => {
    const { update, app, field, task } = await fixture();
    await update({
      options: [
        { originalValue: "Alice", value: "Alex" },
        { originalValue: "Bob", value: "Bob" },
      ],
    });
    for (const [value, status] of [
      ['["Alice"]', 400],
      ['["Alex"]', 200],
    ] as const) {
      const response = await app.request("/api/custom-field/value", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, fieldId: field.id, value }),
      });
      expect(response.status).toBe(status);
    }
  });

  it("rejects readers and users from another workspace", async () => {
    const { update } = await fixture("multiselect", "viewer");
    expect((await update()).status).toBe(403);
    const outsider = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(outsider.user);
    expect((await update()).status).toBe(403);
    mockAnonymousSession();
    expect([401, 403]).toContain((await update()).status);
  });
});

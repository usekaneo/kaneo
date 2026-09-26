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
  await db
    .update(schema.projectTable)
    .set({ lastTaskNumber: 1 })
    .where(eq(schema.projectTable.id, project.id));
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
  it("stores canonical dropdown options and defaults for subsequent task creation", async () => {
    const { app, project } = await fixture();
    const created = await app.request("/api/custom-field", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        name: "Spaced",
        type: "dropdown",
        required: false,
        options: [" Alice ", "Alice", " ", "Bob"],
        defaultValue: " Alice ",
      }),
    });
    expect(created.status, await created.clone().text()).toBe(200);
    expect(await created.json()).toMatchObject({
      options: ["Alice", "Bob"],
      defaultValue: "Alice",
    });
    const task = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Uses defaults",
        description: "",
        priority: "no-priority",
        status: "to-do",
      }),
    });
    expect(task.status, await task.clone().text()).toBe(200);
  });

  it("normalizes legacy dropdown defaults before renaming options", async () => {
    const { field, update } = await fixture("dropdown");
    await db
      .update(schema.customFieldDefinitionTable)
      .set({ defaultValue: " Alice ", updatedAt: field.updatedAt })
      .where(eq(schema.customFieldDefinitionTable.id, field.id));
    const response = await update({
      options: [
        { originalValue: "Alice", value: "Alex" },
        { originalValue: "Bob", value: "Bob" },
        { originalValue: "Unused", value: "Unused" },
      ],
    });
    expect(response.status).toBe(200);
    expect((await response.json()).defaultValue).toBe("Alex");
  });

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

  it.each([false, true])(
    "migrates bounded batches atomically (late invalid value: %s)",
    async (invalid) => {
      const { project, task, field, update } = await fixture();
      const tasks = await db
        .insert(schema.taskTable)
        .values(
          Array.from({ length: 501 }, (_, index) => ({
            projectId: project.id,
            title: "Batch task",
            number: index + 2,
            status: task.status,
            columnId: task.columnId,
          })),
        )
        .returning({ id: schema.taskTable.id });
      await db.insert(schema.customFieldValueTable).values(
        tasks.map((item, index) => ({
          id: `batch-${String(index).padStart(4, "0")}`,
          taskId: item.id,
          fieldId: field.id,
          value: invalid && index === 500 ? '["Unused"]' : '["Alice","Bob"]',
        })),
      );
      const response = await update({
        options: [
          { originalValue: "Alice", value: "Bob" },
          { originalValue: "Bob", value: "Alice" },
        ],
      });
      expect(response.status).toBe(invalid ? 400 : 200);
      const values = await db
        .select({ value: schema.customFieldValueTable.value })
        .from(schema.customFieldValueTable)
        .where(eq(schema.customFieldValueTable.fieldId, field.id));
      expect(values).toHaveLength(502);
      expect(
        values.filter(
          (row) =>
            row.value === (invalid ? '["Alice","Bob"]' : '["Bob","Alice"]'),
        ),
      ).toHaveLength(invalid ? 501 : 502);
    },
  );

  it("reorders fields in reverse ID order while creating tasks", async () => {
    const { project, field, app } = await fixture();
    const [other] = await db
      .insert(schema.customFieldDefinitionTable)
      .values({
        projectId: project.id,
        name: "Other",
        type: "text",
        required: false,
      })
      .returning();
    const reversed = [field, other]
      .sort((a, b) => b.id.localeCompare(a.id))
      .map((item, position) => ({ id: item.id, position }));
    const results = await Promise.all([
      app.request(`/api/custom-field/reorder/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: reversed }),
      }),
      app.request(`/api/task/${project.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          title: "Concurrent task",
          priority: "no-priority",
          description: "",
          status: "to-do",
        }),
      }),
    ]);
    expect(
      results.map((result) => result.status),
      await results[1].clone().text(),
    ).toEqual([200, 200]);
    expect(
      (await results[0].json()).map(
        (item: { id: string; position: number }) => ({
          id: item.id,
          position: item.position,
        }),
      ),
    ).toEqual(reversed);
  });

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

describe("hidden custom field options", () => {
  it.each(["dropdown", "multiselect"])(
    "hides and restores %s options while preserving history",
    async (type) => {
      const { update, readValue, field, task, app } = await fixture(type);
      const options = [
        { originalValue: "Alice", value: "Alice", hidden: true },
        { originalValue: "Bob", value: "Bob" },
        { originalValue: "Unused", value: "Unused" },
      ];
      const response = await update({ options });
      expect(response.status).toBe(200);
      const hidden = await response.json();
      expect(hidden).toMatchObject({
        hiddenOptions: ["Alice"],
        defaultValue: null,
      });
      const original = type === "multiselect" ? '["Alice","Bob"]' : "Alice";
      expect(await readValue()).toBe(original);
      const metadata = await app.request(`/api/custom-field/task/${task.id}`);
      expect(await metadata.json()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fieldHiddenOptions: ["Alice"],
            value: original,
          }),
        ]),
      );
      const set = (value: string) =>
        app.request("/api/custom-field/value", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: task.id, fieldId: field.id, value }),
        });
      expect((await set(original)).status).toBe(200);
      expect(
        (await set(type === "multiselect" ? '["Bob"]' : "Bob")).status,
      ).toBe(200);
      expect((await set(original)).status).toBe(400);
      const shown = await update({
        updatedAt: hidden.updatedAt,
        options: options.map((option) => ({ ...option, hidden: false })),
      });
      expect(shown.status).toBe(200);
      expect(await shown.json()).toMatchObject({ hiddenOptions: [] });
      expect((await set(original)).status).toBe(200);
    },
  );

  it("does not allow hidden selections on a new task or copy them to a duplicate", async () => {
    const { update, field, task, app, project } = await fixture();
    await update({
      options: [
        { originalValue: "Alice", value: "Alice", hidden: true },
        { originalValue: "Bob", value: "Bob" },
      ],
    });
    for (const [value, status] of [
      ['["Alice"]', 400],
      ['["Bob"]', 200],
    ] as const) {
      const response = await app.request(`/api/task/${project.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New task",
          description: "",
          status: "to-do",
          priority: "no-priority",
          customFields: [{ fieldId: field.id, value }],
        }),
      });
      expect(response.status, await response.clone().text()).toBe(status);
    }
    const duplicate = await app.request(`/api/task/duplicate/${task.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(duplicate.status, await duplicate.clone().text()).toBe(200);
    const copied = await duplicate.json();
    const value = await db.query.customFieldValueTable.findFirst({
      where: eq(schema.customFieldValueTable.taskId, copied.id),
    });
    expect(value?.value).toBe('["Bob"]');
  });

  it("preserves hidden status when an older client renames options", async () => {
    const { update, readValue } = await fixture();
    const hidden = await (
      await update({
        options: [
          { originalValue: "Alice", value: "Alice", hidden: true },
          { originalValue: "Bob", value: "Bob" },
        ],
      })
    ).json();
    const response = await update({
      updatedAt: hidden.updatedAt,
      options: [
        { originalValue: "Alice", value: "Alex" },
        { originalValue: "Bob", value: "Bob" },
      ],
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ hiddenOptions: ["Alex"] });
    expect(await readValue()).toBe('["Alex","Bob"]');
  });

  it("allows hiding every option only for optional fields", async () => {
    const { update, field } = await fixture();
    const options = [
      { originalValue: "Alice", value: "Alice", hidden: true },
      { originalValue: "Bob", value: "Bob", hidden: true },
    ];
    expect((await update({ options })).status).toBe(200);
    const [required] = await db
      .update(schema.customFieldDefinitionTable)
      .set({ required: true })
      .where(eq(schema.customFieldDefinitionTable.id, field.id))
      .returning();
    expect(
      (await update({ options, updatedAt: required.updatedAt.toISOString() }))
        .status,
    ).toBe(400);
  });

  it("clears only hidden defaults and keeps visible default selections", async () => {
    const { update, field } = await fixture();
    const [changed] = await db
      .update(schema.customFieldDefinitionTable)
      .set({ defaultValue: '["Alice","Bob"]' })
      .where(eq(schema.customFieldDefinitionTable.id, field.id))
      .returning();
    const response = await update({
      updatedAt: changed.updatedAt.toISOString(),
      options: [
        { originalValue: "Alice", value: "Alice", hidden: true },
        { originalValue: "Bob", value: "Bob" },
      ],
    });
    expect(await response.json()).toMatchObject({
      defaultValue: '["Bob"]',
      hiddenOptions: ["Alice"],
    });
  });
});

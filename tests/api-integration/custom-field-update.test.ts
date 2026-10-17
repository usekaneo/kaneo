import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);

type FieldSeed = Partial<
  typeof schema.customFieldDefinitionTable.$inferInsert
> & { type: string };

async function fixture({
  role = "admin",
  field: fieldSeed,
  values = [],
}: {
  role?: string;
  field: FieldSeed;
  values?: Array<string | null>;
}) {
  const member = await createWorkspaceMember({ role });
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [field] = await db
    .insert(schema.customFieldDefinitionTable)
    .values({
      projectId: project.id,
      name: "Size",
      required: false,
      position: 0,
      ...fieldSeed,
    })
    .returning();

  const tasks = [];
  for (const [index, value] of values.entries()) {
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: `Task ${index + 1}`,
        number: index + 1,
        status: "to-do",
        columnId: columns.todo.id,
      })
      .returning();
    tasks.push(task);
    if (value !== null) {
      await db
        .insert(schema.customFieldValueTable)
        .values({ taskId: task.id, fieldId: field.id, value });
    }
  }

  mockAuthenticatedSession(member.user);
  const { app } = createApp();

  const update = (body: Record<string, unknown>) =>
    app.request(`/api/custom-field/${field.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  return { member, project, field, tasks, app, update };
}

async function readField(id: string) {
  const [field] = await db
    .select()
    .from(schema.customFieldDefinitionTable)
    .where(eq(schema.customFieldDefinitionTable.id, id));
  return field;
}

async function readValues(fieldId: string) {
  const rows = await db
    .select({
      taskId: schema.customFieldValueTable.taskId,
      value: schema.customFieldValueTable.value,
    })
    .from(schema.customFieldValueTable)
    .where(eq(schema.customFieldValueTable.fieldId, fieldId));
  return new Map(rows.map((row) => [row.taskId, row.value]));
}

describe("PUT /custom-field/{id}", () => {
  it("updates the name, options, and default", async () => {
    const { field, update } = await fixture({
      field: {
        type: "dropdown",
        options: ["Small", "Medium"],
        defaultValue: "Small",
      },
    });

    const response = await update({
      name: "  T-shirt size ",
      options: ["Large", "Medium", "Small", "Large"],
      defaultValue: "Medium",
    });

    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({
      id: field.id,
      name: "T-shirt size",
      type: "dropdown",
      options: ["Large", "Medium", "Small"],
      defaultValue: "Medium",
    });
    expect(await readField(field.id)).toMatchObject({
      name: "T-shirt size",
      options: ["Large", "Medium", "Small"],
      defaultValue: "Medium",
    });
  });

  it("fills tasks without a value when a field becomes required", async () => {
    const { field, tasks, update } = await fixture({
      field: { type: "text" },
      values: ["Acme", null, ""],
    });

    const response = await update({ required: true, defaultValue: "Internal" });

    expect(response.status, await response.clone().text()).toBe(200);
    const values = await readValues(field.id);
    expect(values.get(tasks[0].id)).toBe("Acme");
    expect(values.get(tasks[1].id)).toBe("Internal");
    expect(values.get(tasks[2].id)).toBe("Internal");
  });

  it("rejects making a field required without a default", async () => {
    const { field, update } = await fixture({ field: { type: "text" } });

    const response = await update({ required: true });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain(
      "Required fields must have a default value",
    );
    expect((await readField(field.id)).required).toBe(false);
  });

  it("denies members without project:update", async () => {
    const { field, update } = await fixture({
      role: "member",
      field: { type: "text" },
    });

    const response = await update({ name: "Renamed" });

    expect(response.status).toBe(403);
    expect((await readField(field.id)).name).toBe("Size");
  });

  it("hides fields in other workspaces", async () => {
    const { field } = await fixture({ field: { type: "text" } });
    const outsider = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(outsider.user);
    const { app } = createApp();

    const response = await app.request(`/api/custom-field/${field.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Renamed" }),
    });

    expect(response.status).toBe(404);
    expect((await readField(field.id)).name).toBe("Size");
  });

  it("rejects a type change", async () => {
    const { field, update } = await fixture({ field: { type: "text" } });

    const response = await update({ type: "number" });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("can't change");
    expect((await readField(field.id)).type).toBe("text");
  });

  it("rejects removing an option that a task uses and keeps its value", async () => {
    const { field, tasks, update } = await fixture({
      field: { type: "dropdown", options: ["Small", "Medium", "Large"] },
      values: ["Small"],
    });

    const response = await update({ options: ["Smol", "Medium", "Large"] });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain(
      'Can\'t remove "Small" because tasks still use it',
    );
    expect((await readField(field.id)).options).toEqual([
      "Small",
      "Medium",
      "Large",
    ]);
    expect((await readValues(field.id)).get(tasks[0].id)).toBe("Small");
  });

  it("allows removing options no task uses", async () => {
    const { field, update } = await fixture({
      field: { type: "multiselect", options: ["iOS", "Android", "Web"] },
      values: ['["iOS","Web"]'],
    });

    const response = await update({ options: ["Web", "iOS"] });

    expect(response.status, await response.clone().text()).toBe(200);
    expect((await readField(field.id)).options).toEqual(["Web", "iOS"]);
  });

  it("converts task values when a dropdown starts allowing several", async () => {
    const { field, tasks, update } = await fixture({
      field: {
        type: "dropdown",
        options: ["Small", "Large"],
        defaultValue: "Small",
      },
      values: ["Small", "Large", ""],
    });

    const response = await update({ type: "multiselect" });

    expect(response.status, await response.clone().text()).toBe(200);
    expect(await readField(field.id)).toMatchObject({
      type: "multiselect",
      defaultValue: '["Small"]',
    });
    const values = await readValues(field.id);
    expect(values.get(tasks[0].id)).toBe('["Small"]');
    expect(values.get(tasks[1].id)).toBe('["Large"]');
    expect(values.get(tasks[2].id)).toBe("");
  });

  it("refuses to stop allowing several while a task has two picks", async () => {
    const { field, tasks, update } = await fixture({
      field: { type: "multiselect", options: ["iOS", "Web"] },
      values: ['["iOS","Web"]'],
    });

    const response = await update({ type: "dropdown" });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("more than one option");
    expect((await readField(field.id)).type).toBe("multiselect");
    expect((await readValues(field.id)).get(tasks[0].id)).toBe('["iOS","Web"]');
  });
});

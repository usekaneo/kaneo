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

async function fixture(
  field: Partial<typeof schema.customFieldDefinitionTable.$inferInsert> & {
    type: string;
  },
) {
  const member = await createWorkspaceMember({ role: "admin" });
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [definition] = await db
    .insert(schema.customFieldDefinitionTable)
    .values({
      projectId: project.id,
      name: "Platform",
      required: false,
      position: 0,
      ...field,
    })
    .returning();
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Task",
      number: 1,
      status: "to-do",
      columnId: columns.todo.id,
    })
    .returning();
  // Tasks created through the API claim numbers after this one.
  await db
    .update(schema.projectTable)
    .set({ lastTaskNumber: 1 })
    .where(eq(schema.projectTable.id, project.id));

  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const json = (method: string, path: string, body: unknown) =>
    app.request(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  return {
    project,
    field: definition,
    task,
    update: (body: Record<string, unknown>) =>
      json("PUT", `/api/custom-field/${definition.id}`, body),
    setValue: (value: string) =>
      json("PUT", "/api/custom-field/value", {
        taskId: task.id,
        fieldId: definition.id,
        value,
      }),
    createTask: (value: string) =>
      json("POST", `/api/task/${project.id}`, {
        title: "New task",
        description: "",
        status: "to-do",
        priority: "no-priority",
        customFields: [{ fieldId: definition.id, value }],
      }),
  };
}

async function storedValue(taskId: string) {
  const [row] = await db
    .select({ value: schema.customFieldValueTable.value })
    .from(schema.customFieldValueTable)
    .where(eq(schema.customFieldValueTable.taskId, taskId));
  return row?.value;
}

describe("hidden custom field options", () => {
  it("hides an option and returns it with the field", async () => {
    const { update } = await fixture({
      type: "dropdown",
      options: ["Web", "iOS"],
    });

    const response = await update({ hiddenOptions: ["iOS"] });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      options: ["Web", "iOS"],
      hiddenOptions: ["iOS"],
    });
  });

  it("rejects hidden options that aren't options", async () => {
    const { update } = await fixture({
      type: "dropdown",
      options: ["Web", "iOS"],
    });

    const response = await update({ hiddenOptions: ["Android"] });

    expect(response.status).toBe(400);
  });

  it("refuses to hide the default", async () => {
    const { update } = await fixture({
      type: "dropdown",
      options: ["Web", "iOS"],
      defaultValue: "Web",
    });

    const response = await update({ hiddenOptions: ["Web"] });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("default");
  });

  it("drops a hidden option when the option itself is removed", async () => {
    const { update } = await fixture({
      type: "dropdown",
      options: ["Web", "iOS", "Android"],
      hiddenOptions: ["Android"],
    });

    const response = await update({ options: ["Web", "iOS"] });

    expect(response.status).toBe(200);
    expect((await response.json()).hiddenOptions).toEqual([]);
  });

  it("keeps a task's hidden selection but blocks picking it anew", async () => {
    const { task, field, setValue } = await fixture({
      type: "multiselect",
      options: ["Web", "iOS", "Windows Phone"],
      hiddenOptions: ["Windows Phone"],
    });
    await db.insert(schema.customFieldValueTable).values({
      taskId: task.id,
      fieldId: field.id,
      value: JSON.stringify(["Windows Phone"]),
    });

    const kept = await setValue(JSON.stringify(["Windows Phone", "Web"]));
    expect(kept.status).toBe(200);
    expect(await storedValue(task.id)).toBe(
      JSON.stringify(["Windows Phone", "Web"]),
    );

    expect((await setValue(JSON.stringify(["Web"]))).status).toBe(200);

    const repicked = await setValue(JSON.stringify(["Web", "Windows Phone"]));
    expect(repicked.status).toBe(400);
    expect(await storedValue(task.id)).toBe(JSON.stringify(["Web"]));
  });

  it("rejects a hidden option on a dropdown and in task creation", async () => {
    const { setValue, createTask } = await fixture({
      type: "dropdown",
      options: ["Web", "iOS"],
      hiddenOptions: ["iOS"],
    });

    expect((await setValue("iOS")).status).toBe(400);
    expect((await setValue("Web")).status).toBe(200);
    expect((await createTask("iOS")).status).toBe(400);
    expect((await createTask("Web")).status).toBe(200);
  });

  it("suggests hiding when an option in use can't be removed", async () => {
    const { task, field, update } = await fixture({
      type: "dropdown",
      options: ["Web", "iOS"],
    });
    await db
      .insert(schema.customFieldValueTable)
      .values({ taskId: task.id, fieldId: field.id, value: "iOS" });

    const response = await update({ options: ["Web"] });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("hide it");
  });
});

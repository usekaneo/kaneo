import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type Project = typeof schema.projectTable.$inferSelect;

function createRequest(
  workspaceId: string,
  sourceProjectId?: string,
  options: { includeTasks?: boolean; asTemplate?: boolean } = {},
) {
  return new Request("http://localhost/api/project", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workspaceId,
      name: "Copied project",
      icon: "Layers",
      slug: "copied-project",
      sourceProjectId,
      ...options,
    }),
  });
}

async function seedSource(workspaceId: string, assigneeId?: string) {
  const { project, columns } = await createProjectFixture({ workspaceId });
  await db
    .update(schema.projectTable)
    .set({ description: "Source notes", isPublic: true })
    .where(eq(schema.projectTable.id, project.id));
  await db
    .update(schema.columnTable)
    .set({ name: "Ready", icon: "Circle", color: "#123456", position: 6 })
    .where(eq(schema.columnTable.id, columns.todo.id));
  await db
    .update(schema.columnTable)
    .set({ name: "Shipped", icon: "Check", color: "#abcdef", position: 9 })
    .where(eq(schema.columnTable.id, columns.done.id));
  await db.insert(schema.workflowRuleTable).values({
    projectId: project.id,
    columnId: columns.done.id,
    integrationType: "github",
    eventType: "closed",
  });
  const [field] = await db
    .insert(schema.customFieldDefinitionTable)
    .values({
      projectId: project.id,
      name: "Effort",
      type: "dropdown",
      options: ["Small", "Large"],
      required: true,
      defaultValue: "Small",
      position: 3,
    })
    .returning();
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.done.id,
      userId: assigneeId,
      number: 7,
      title: "Ship release",
      description: "Release notes",
      status: "done",
      priority: "high",
      position: 8,
      dueDate: new Date("2026-10-01T00:00:00Z"),
    })
    .returning();
  await db.insert(schema.labelTable).values({
    taskId: task.id,
    workspaceId,
    name: "Release",
    color: "#654321",
  });
  await db.insert(schema.customFieldValueTable).values({
    taskId: task.id,
    fieldId: field.id,
    value: "Large",
  });
  return { project, columns, field, task };
}

describe("API integration: project templates and duplication", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("copies configuration but no tasks by default and creates a private project", async () => {
    const member = await createWorkspaceMember();
    const source = await seedSource(member.workspace.id);
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(
      createRequest(member.workspace.id, source.project.id),
    );
    expect(response.status).toBe(200);
    const created = (await response.json()) as Project;
    expect(created).toMatchObject({
      name: "Copied project",
      slug: "copied-project",
      icon: "Layers",
      description: "Source notes",
      isPublic: false,
      isTemplate: false,
      lastTaskNumber: 0,
    });

    const columns = await db.query.columnTable.findMany({
      where: eq(schema.columnTable.projectId, created.id),
      orderBy: (column, { asc }) => [asc(column.position)],
    });
    expect(
      columns.map(({ name, slug, position, icon, color, isFinal }) => ({
        name,
        slug,
        position,
        icon,
        color,
        isFinal,
      })),
    ).toEqual([
      {
        name: "In Progress",
        slug: "in-progress",
        position: 1,
        icon: null,
        color: null,
        isFinal: false,
      },
      {
        name: "In Review",
        slug: "in-review",
        position: 2,
        icon: null,
        color: null,
        isFinal: false,
      },
      {
        name: "Ready",
        slug: "to-do",
        position: 6,
        icon: "Circle",
        color: "#123456",
        isFinal: false,
      },
      {
        name: "Shipped",
        slug: "done",
        position: 9,
        icon: "Check",
        color: "#abcdef",
        isFinal: true,
      },
    ]);
    expect(
      columns.every(
        (column) =>
          !Object.values(source.columns).some((old) => old.id === column.id),
      ),
    ).toBe(true);
    const [field] = await db.query.customFieldDefinitionTable.findMany({
      where: eq(schema.customFieldDefinitionTable.projectId, created.id),
    });
    expect(field).toMatchObject({
      name: "Effort",
      type: "dropdown",
      options: ["Small", "Large"],
      required: true,
      defaultValue: "Small",
      position: 3,
    });
    expect(field.id).not.toBe(source.field.id);
    const [rule] = await db.query.workflowRuleTable.findMany({
      where: eq(schema.workflowRuleTable.projectId, created.id),
    });
    expect(rule).toMatchObject({
      integrationType: "github",
      eventType: "closed",
    });
    expect(rule.columnId).toBe(
      columns.find((column) => column.slug === "done")?.id,
    );
    expect(
      await db.query.taskTable.findMany({
        where: eq(schema.taskTable.projectId, created.id),
      }),
    ).toEqual([]);
  });

  it("copies task content, per-task labels, and remapped custom field values only when requested", async () => {
    const member = await createWorkspaceMember();
    const source = await seedSource(member.workspace.id, member.user.id);
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(
      createRequest(member.workspace.id, source.project.id, {
        includeTasks: true,
      }),
    );
    expect(response.status).toBe(200);
    const created = (await response.json()) as Project;
    const [task] = await db.query.taskTable.findMany({
      where: eq(schema.taskTable.projectId, created.id),
    });
    expect(task).toMatchObject({
      title: "Ship release",
      description: "Release notes",
      status: "done",
      priority: "high",
      position: 8,
      number: 1,
      userId: null,
      startDate: null,
      dueDate: null,
    });
    expect(task.id).not.toBe(source.task.id);
    expect(created.lastTaskNumber).toBe(1);
    const [column] = await db.query.columnTable.findMany({
      where: and(
        eq(schema.columnTable.projectId, created.id),
        eq(schema.columnTable.slug, "done"),
      ),
    });
    expect(task.columnId).toBe(column.id);
    const [label] = await db.query.labelTable.findMany({
      where: eq(schema.labelTable.taskId, task.id),
    });
    expect(label).toMatchObject({
      name: "Release",
      color: "#654321",
      workspaceId: member.workspace.id,
    });
    const [value] = await db.query.customFieldValueTable.findMany({
      where: eq(schema.customFieldValueTable.taskId, task.id),
    });
    const [field] = await db.query.customFieldDefinitionTable.findMany({
      where: eq(schema.customFieldDefinitionTable.projectId, created.id),
    });
    expect(value).toMatchObject({ fieldId: field.id, value: "Large" });
  });

  it("keeps saved templates out of ordinary and archived project lists, scoped to their workspace", async () => {
    const owner = await createWorkspaceMember({ role: "admin" });
    const other = await createWorkspaceMember();
    const source = await seedSource(owner.workspace.id);
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const response = await app.request(
      createRequest(owner.workspace.id, source.project.id, {
        asTemplate: true,
      }),
    );
    expect(response.status).toBe(200);
    const template = (await response.json()) as Project;
    expect(template.isTemplate).toBe(true);
    expect(template.isPublic).toBe(false);
    expect(
      await db.query.taskTable.findMany({
        where: eq(schema.taskTable.projectId, template.id),
      }),
    ).toEqual([]);
    const list = await app.request(
      `/api/project?workspaceId=${owner.workspace.id}`,
    );
    expect(
      ((await list.json()) as Project[]).map((project) => project.id),
    ).toEqual([source.project.id]);
    const archivedList = await app.request(
      `/api/project?workspaceId=${owner.workspace.id}&includeArchived=true`,
    );
    expect(
      ((await archivedList.json()) as Project[]).map((project) => project.id),
    ).toEqual([source.project.id]);
    const templates = await app.request(
      `/api/project/templates?workspaceId=${owner.workspace.id}`,
    );
    expect(templates.status).toBe(200);
    expect(
      ((await templates.json()) as Project[]).map((project) => project.id),
    ).toEqual([template.id]);
    const search = await app.request(
      `/api/search?q=Copied&type=projects&workspaceId=${owner.workspace.id}`,
    );
    expect(search.status).toBe(200);
    expect(
      ((await search.json()) as { results: Array<{ id: string }> }).results.map(
        (result) => result.id,
      ),
    ).not.toContain(template.id);
    const reordered = await app.request(
      `/api/project/reorder?workspaceId=${owner.workspace.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projects: [{ id: source.project.id, position: 0 }],
        }),
      },
    );
    expect(reordered.status).toBe(200);
    expect(
      ((await reordered.json()) as Project[]).map((project) => project.id),
    ).toEqual([source.project.id]);
    expect(
      (
        await app.request(
          `/api/project/templates?workspaceId=${other.workspace.id}`,
        )
      ).status,
    ).toBe(403);
    mockAuthenticatedSession(other.user);
    const others = await app.request(
      `/api/project/templates?workspaceId=${other.workspace.id}`,
    );
    expect(others.status).toBe(200);
    expect(await others.json()).toEqual([]);
    mockAuthenticatedSession(owner.user);
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "member" })
      .where(
        and(
          eq(schema.workspaceUserTable.workspaceId, owner.workspace.id),
          eq(schema.workspaceUserTable.userId, owner.user.id),
        ),
      );
    expect(
      (await app.request(`/api/project/${template.id}`, { method: "DELETE" }))
        .status,
    ).toBe(403);
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "admin" })
      .where(
        and(
          eq(schema.workspaceUserTable.workspaceId, owner.workspace.id),
          eq(schema.workspaceUserTable.userId, owner.user.id),
        ),
      );
    const deleted = await app.request(`/api/project/${template.id}`, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(200);
    expect(
      await (
        await app.request(
          `/api/project/templates?workspaceId=${owner.workspace.id}`,
        )
      ).json(),
    ).toEqual([]);
  });

  it("denies a source outside the destination workspace without creating a project", async () => {
    const sourceOwner = await createWorkspaceMember();
    const destinationOwner = await createWorkspaceMember();
    const source = await seedSource(sourceOwner.workspace.id);
    mockAuthenticatedSession(destinationOwner.user);
    const { app } = createApp();
    const response = await app.request(
      createRequest(destinationOwner.workspace.id, source.project.id, {
        includeTasks: true,
      }),
    );
    expect(response.status).toBe(404);
    const projects = await db.query.projectTable.findMany({
      where: eq(schema.projectTable.workspaceId, destinationOwner.workspace.id),
    });
    expect(projects).toEqual([]);
  });

  it("rejects a template without a source", async () => {
    const member = await createWorkspaceMember();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const response = await app.request(
      createRequest(member.workspace.id, undefined, { asTemplate: true }),
    );
    expect(response.status).toBe(400);
    expect(
      await db.query.projectTable.findMany({
        where: eq(schema.projectTable.workspaceId, member.workspace.id),
      }),
    ).toEqual([]);
  });
});

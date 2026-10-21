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
async function fixture() {
  const member = await createWorkspaceMember();
  const first = await createProjectFixture({
    workspaceId: member.workspace.id,
    slug: "WEB",
  });
  const second = await createProjectFixture({
    workspaceId: member.workspace.id,
    slug: "API",
  });
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const get = (params: Record<string, string> = {}) =>
    app.request(
      `/api/task/workspace?${new URLSearchParams({ workspaceId: member.workspace.id, ...params })}`,
    );
  let number = 1000;
  const insert = async (
    title: string,
    projectId = first.project.id,
    extra: Partial<typeof schema.taskTable.$inferInsert> = {},
  ) => {
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId,
        number: number++,
        title,
        status: "to-do",
        priority: "low",
        columnId:
          projectId === first.project.id
            ? first.columns.todo.id
            : second.columns.todo.id,
        ...extra,
      })
      .returning();
    return task;
  };
  return { member, first, second, get, insert };
}
describe("workspace task overview", () => {
  it("uses each task's project workflow, even for identical status slugs", async () => {
    const { first, second, get, insert } = await fixture();
    await db
      .update(schema.columnTable)
      .set({ isFinal: true })
      .where(eq(schema.columnTable.id, second.columns.todo.id));
    const open = await insert("Open in WEB");
    const done = await insert("Complete in API", second.project.id);
    expect((await get()).status).toBe(200);
    let body = await (await get({ completion: "all" })).json();
    expect(body.total).toBe(2);
    expect(
      body.tasks.find((task: { id: string }) => task.id === open.id),
    ).toMatchObject({ completed: false, projectId: first.project.id });
    expect(
      body.tasks.find((task: { id: string }) => task.id === done.id),
    ).toMatchObject({ completed: true, projectId: second.project.id });
    body = await (await get({ completion: "completed" })).json();
    expect(body.tasks.map((task: { id: string }) => task.id)).toEqual([
      done.id,
    ]);
    body = await (await get()).json();
    expect(body.tasks.map((task: { id: string }) => task.id)).toEqual([
      open.id,
    ]);
  });
  it("filters before pagination and matches additional assignees", async () => {
    const { member, first, second, get, insert } = await fixture();
    await db.insert(schema.taskTable).values(
      Array.from({ length: 105 }, (_, index) => ({
        projectId: first.project.id,
        columnId: first.columns.todo.id,
        title: `Target ${index}`,
        priority: "high",
        status: "to-do",
        number: index + 1,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      })),
    );
    await insert("Excluded", second.project.id, { priority: "urgent" });
    const one = await (
      await get({ projectId: first.project.id, priority: "high" })
    ).json();
    const two = await (
      await get({ projectId: first.project.id, priority: "high", page: "2" })
    ).json();
    expect(one.total).toBe(105);
    expect(one.tasks).toHaveLength(100);
    expect(two.tasks).toHaveLength(5);
    expect(
      new Set([...one.tasks, ...two.tasks].map((task) => task.id)).size,
    ).toBe(105);
    const assigned = await insert("Co-owned", first.project.id, {
      userId: null,
    });
    await db
      .insert(schema.taskCoAssigneeTable)
      .values({ taskId: assigned.id, userId: member.user.id });
    const mine = await (await get({ assigneeId: member.user.id })).json();
    expect(mine.total).toBe(1);
    expect(mine.tasks[0]).toMatchObject({
      id: assigned.id,
      assignees: [{ id: member.user.id, name: member.user.name }],
    });
    const unassigned = await (
      await get({ assigneeId: "unassigned", search: "Co-owned" })
    ).json();
    expect(unassigned.total).toBe(0);
  });
  it("does not count or decorate inaccessible, cross-workspace or archived work", async () => {
    const { member, first, second, get, insert } = await fixture();
    const other = await createWorkspaceMember();
    const outside = await createProjectFixture({
      workspaceId: other.workspace.id,
    });
    const archived = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await db
      .update(schema.projectTable)
      .set({ archivedAt: new Date() })
      .where(eq(schema.projectTable.id, archived.project.id));
    const visible = await insert("Visible");
    await insert("Private", second.project.id);
    await insert("Other workspace", outside.project.id, { columnId: null });
    await insert("Archived project", archived.project.id, { columnId: null });
    await insert("Archived task", first.project.id, {
      status: "archived",
      columnId: null,
    });
    await db.insert(schema.workspaceMemberAccessTable).values({
      workspaceId: member.workspace.id,
      userId: member.user.id,
      projectAccess: "selected",
    });
    await db.insert(schema.workspaceMemberProjectTable).values({
      workspaceId: member.workspace.id,
      userId: member.user.id,
      projectId: first.project.id,
    });
    const body = await (await get({ completion: "all" })).json();
    expect(body.total).toBe(1);
    expect(body.tasks.map((task: { id: string }) => task.id)).toEqual([
      visible.id,
    ]);
    expect(await (await get({ projectId: second.project.id })).json()).toEqual({
      tasks: [],
      total: 0,
    });
    expect((await get({ workspaceId: other.workspace.id })).status).toBe(404);
  });
  it("searches titles and identifiers as literals rather than SQL wildcards", async () => {
    const { get, insert } = await fixture();
    const literal = await insert("100%_done", undefined, { number: 17 });
    await insert("100abcZdone");
    for (const search of ["%_", "web-17", "100%_done"]) {
      const body = await (await get({ search })).json();
      expect(body.total).toBe(1);
      expect(body.tasks[0].id).toBe(literal.id);
    }
  });
  it("rejects invalid paging and filters", async () => {
    const { get } = await fixture();
    for (const params of [
      { page: "0" },
      { page: "NaN" },
      { page: "1000001" },
      { priority: "bogus" },
      { completion: "archived" },
      { search: "x".repeat(201) },
    ])
      expect((await get(params)).status).toBe(400);
  });
  it("requires both project and task read permissions", async () => {
    const { member, get } = await fixture();
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "limited" })
      .where(eq(schema.workspaceUserTable.userId, member.user.id));
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: member.workspace.id,
      role: "limited",
      permission: JSON.stringify({ project: ["read"] }),
    });
    expect((await get()).status).toBe(403);
  });
});

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import * as taskController from "../../apps/api/src/task/controllers/get-tasks";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { readErrorBody } from "./helpers/error-body";

beforeEach(resetTestDatabase);
async function fixture(count = 237, publicProject = false) {
  const member = await createWorkspaceMember();
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  if (publicProject)
    await db
      .update(schema.projectTable)
      .set({ isPublic: true })
      .where(eq(schema.projectTable.id, project.id));
  const tasks = count
    ? await db
        .insert(schema.taskTable)
        .values(
          Array.from({ length: count }, (_, index) => ({
            id: `page-task-${String(index).padStart(4, "0")}`,
            projectId: project.id,
            title: `Task ${index}`,
            description: `Description ${index}`,
            number: index + 1,
            position: 100,
            status:
              index % 3 === 0
                ? "planned"
                : index % 3 === 1
                  ? "archived"
                  : "to-do",
            priority: index % 2 ? "high" : "low",
          })),
        )
        .returning()
    : [];
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  return { project, member, tasks, app };
}
function allTasks(board: {
  columns: { tasks: { id: string; number: number }[] }[];
  archivedTasks: { id: string; number: number }[];
  plannedTasks: { id: string; number: number }[];
}) {
  return [
    ...board.columns.flatMap((column) => column.tasks),
    ...board.archivedTasks,
    ...board.plannedTasks,
  ];
}
describe("bounded task pages", () => {
  it("bounds the default and retrieves every bucket with deterministic tied-position ordering", async () => {
    const { project, app, tasks } = await fixture();
    const first = await app.request(`/api/task/tasks/${project.id}`);
    expect(first.status).toBe(200);
    const initial = await first.json();
    expect(allTasks(initial.data)).toHaveLength(50);
    expect(initial.pagination).toMatchObject({
      page: 1,
      pageSize: 50,
      total: 237,
      totalPages: 5,
    });
    const ids = allTasks(initial.data).map((task) => task.id);
    for (let page = 2; page <= initial.pagination.totalPages; page++) {
      const response = await app.request(
        `/api/task/tasks/${project.id}?page=${page}`,
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(allTasks(data.data).length).toBeLessThanOrEqual(50);
      ids.push(...allTasks(data.data).map((task) => task.id));
    }
    expect(new Set(ids).size).toBe(237);
    expect(ids.sort()).toEqual(tasks.map((task) => task.id).sort());
  });
  it("applies filters and sorting before paginating and keeps labels and links with their tasks", async () => {
    const { project, member, tasks, app } = await fixture();
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({ projectId: project.id, type: "github", config: "{}" })
      .returning();
    const task = tasks[235];
    await db.insert(schema.labelTable).values({
      name: "late-page-label",
      color: "red",
      workspaceId: member.workspace.id,
      taskId: task.id,
    });
    await db.insert(schema.externalLinkTable).values({
      integrationId: integration.id,
      taskId: task.id,
      resourceType: "issue",
      externalId: "235",
      url: "https://github.com/example/repo/issues/235",
      metadata: JSON.stringify({ state: "open" }),
    });
    const response = await app.request(
      `/api/task/tasks/${project.id}?priority=high&sortBy=number&sortOrder=desc&limit=1`,
    );
    const payload = await response.json();
    expect(payload.pagination).toMatchObject({
      total: 118,
      pageSize: 1,
      totalPages: 118,
    });
    const match = allTasks(payload.data)[0];
    expect(match).toMatchObject({
      id: task.id,
      number: 236,
      labels: [{ name: "late-page-label" }],
      externalLinks: [{ externalId: "235", metadata: { state: "open" } }],
    });
  });
  it("caps explicit pages at 100 and rejects invalid limits or offsets", async () => {
    const { project, app } = await fixture();
    const response = await app.request(
      `/api/task/tasks/${project.id}?limit=100`,
    );
    expect(allTasks((await response.json()).data)).toHaveLength(100);
    for (const query of [
      "limit=101",
      "limit=0",
      "page=0",
      "page=-1",
      "page=1e9",
      "page=1000001",
    ])
      expect(
        (await app.request(`/api/task/tasks/${project.id}?${query}`)).status,
      ).toBe(400);
  });
  it("rejects another workspace before returning any page", async () => {
    const { project, app } = await fixture();
    const other = await createWorkspaceMember();
    mockAuthenticatedSession(other.user);
    const response = await app.request(`/api/task/tasks/${project.id}?page=2`);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("Description");
  });
  it("paginates public boards and rechecks visibility on every request", async () => {
    const { project, app } = await fixture(237, true);
    mockAnonymousSession();
    const first = await app.request(`/api/public-project/${project.id}`);
    expect(first.status).toBe(200);
    const payload = await first.json();
    expect(allTasks(payload)).toHaveLength(50);
    expect(payload.pagination.totalPages).toBe(5);
    const last = await app.request(
      `/api/public-project/${project.id}?page=3&limit=100`,
    );
    expect(last.status).toBe(200);
    expect(allTasks(await last.json())).toHaveLength(37);
    await db
      .update(schema.projectTable)
      .set({ isPublic: false })
      .where(eq(schema.projectTable.id, project.id));
    const spy = vi.spyOn(taskController, "default");
    const denied = await app.request(
      `/api/public-project/${project.id}?page=2`,
    );
    expect(denied.status).toBe(403);
    expect(spy).not.toHaveBeenCalled(); // getTasks starts here; private boards never reach it.
    spy.mockRestore();
  });
  it("validates public pagination before loading a board", async () => {
    const { project, app } = await fixture(1, true);
    mockAnonymousSession();
    const response = await app.request(
      `/api/public-project/${project.id}?limit=101`,
    );
    expect(response.status).toBe(400);
    expect(await readErrorBody(response)).toMatchObject({
      message: "Invalid task pagination or filters",
      code: "VALIDATION_ERROR",
      issues: [{ path: "query.limit", message: expect.any(String) }],
    });
  });
  it("returns empty pages and an empty project without inventing tasks", async () => {
    const { project, app } = await fixture(0);
    for (const page of [1, 10]) {
      const response = await app.request(
        `/api/task/tasks/${project.id}?page=${page}`,
      );
      const payload = await response.json();
      expect(allTasks(payload.data)).toHaveLength(0);
      expect(payload.data.columns).toHaveLength(4);
      expect(payload.pagination).toMatchObject({
        total: 0,
        totalPages: 1,
        page,
      });
    }
  });
});

it.each(["create", "delete", "move", "reorder"])(
  "changes the public pagination revision after a concurrent %s",
  async (change) => {
    const { project, app, tasks } = await fixture(237, true);
    mockAnonymousSession();
    const first = await app.request(
      `/api/public-project/${project.id}?limit=100`,
    );
    const before = (await first.json()).pagination.revision;
    expect(typeof before).toBe("string");
    const stable = await app.request(
      `/api/public-project/${project.id}?page=2&limit=100`,
    );
    expect((await stable.json()).pagination.revision).toBe(before);
    if (change === "create")
      await db.insert(schema.taskTable).values({
        id: "new-public-task",
        projectId: project.id,
        title: "new",
        number: 999,
        position: 1,
      });
    else if (change === "delete")
      await db
        .delete(schema.taskTable)
        .where(eq(schema.taskTable.id, tasks[0].id));
    else if (change === "move") {
      const { project: other } = await createProjectFixture({
        workspaceId: project.workspaceId,
      });
      await db
        .update(schema.taskTable)
        .set({ projectId: other.id })
        .where(eq(schema.taskTable.id, tasks[0].id));
    } else
      await db
        .update(schema.taskTable)
        .set({ position: 200 })
        .where(eq(schema.taskTable.id, tasks[0].id));
    const later = await app.request(
      `/api/public-project/${project.id}?page=2&limit=100`,
    );
    expect((await later.json()).pagination.revision).not.toBe(before);
  },
);

it("detects task edits between public pages regardless of sort order", async () => {
  const { app, project, tasks } = await fixture(237, true);
  mockAnonymousSession();
  const path = `/api/public-project/${project.id}?limit=100`;
  const position = (await (await app.request(path)).json()).pagination.revision;
  const title = (await (await app.request(path + "&sortBy=title")).json())
    .pagination.revision;
  await db
    .update(schema.taskTable)
    .set({ title: "ZZZ new title" })
    .where(eq(schema.taskTable.id, tasks[0].id));
  expect(
    (await (await app.request(path + "&page=2")).json()).pagination.revision,
  ).not.toBe(position);
  expect(
    (await (await app.request(path + "&page=2&sortBy=title")).json()).pagination
      .revision,
  ).not.toBe(title);
});

it.each(["label", "link", "assignee", "project", "subtask"])(
  "detects a %s edit to an earlier public page while loading a later page",
  async (change) => {
    const { app, project, tasks, member } = await fixture(2, true);
    const task = tasks[0];
    await db
      .update(schema.taskTable)
      .set({ userId: member.user.id })
      .where(eq(schema.taskTable.id, task.id));
    const [label] = await db
      .insert(schema.labelTable)
      .values({
        taskId: task.id,
        workspaceId: member.workspace.id,
        name: "Before",
        color: "red",
      })
      .returning();
    const [link] = await db
      .insert(schema.externalLinkTable)
      .values({
        taskId: task.id,
        resourceType: "pull_request",
        externalId: "1",
        url: "https://example.com/pr/1",
        metadata: JSON.stringify({ merged: false }),
      })
      .returning();
    const { project: childProject } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await db
      .update(schema.projectTable)
      .set({ isPublic: true })
      .where(eq(schema.projectTable.id, childProject.id));
    const [child] = await db
      .insert(schema.taskTable)
      .values({ projectId: childProject.id, title: "Child", status: "to-do" })
      .returning();
    await db.insert(schema.taskRelationTable).values({
      sourceTaskId: task.id,
      targetTaskId: child.id,
      relationType: "subtask",
    });
    mockAnonymousSession();
    const path = `/api/public-project/${project.id}?limit=1`;
    const before = (await (await app.request(path)).json()).pagination.revision;
    expect(
      (await (await app.request(path + "&page=2")).json()).pagination.revision,
    ).toBe(before);
    if (change === "label")
      await db
        .update(schema.labelTable)
        .set({ name: "After" })
        .where(eq(schema.labelTable.id, label.id));
    if (change === "link")
      await db
        .update(schema.externalLinkTable)
        .set({ metadata: JSON.stringify({ merged: true }) })
        .where(eq(schema.externalLinkTable.id, link.id));
    if (change === "assignee")
      await db
        .update(schema.userTable)
        .set({ name: "Renamed", image: "https://example.com/avatar.png" })
        .where(eq(schema.userTable.id, member.user.id));
    if (change === "project")
      await db
        .update(schema.projectTable)
        .set({ name: "Renamed project" })
        .where(eq(schema.projectTable.id, project.id));
    if (change === "subtask")
      await db
        .update(schema.taskTable)
        .set({ status: "done" })
        .where(eq(schema.taskTable.id, child.id));
    expect(
      (await (await app.request(path + "&page=2")).json()).pagination.revision,
    ).not.toBe(before);
  },
);

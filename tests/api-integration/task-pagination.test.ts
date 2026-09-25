import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import * as taskController from "../../apps/api/src/task/controllers/get-tasks";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

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
    expect(response.status).toBe(403);
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
    expect(response.headers.get("Content-Type")).toContain("text/plain");
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

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import getTasks from "../../apps/api/src/task/controllers/get-tasks";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);
async function fixture() {
  const member = await createWorkspaceMember();
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  await db
    .update(schema.projectTable)
    .set({ isPublic: true })
    .where(eq(schema.projectTable.id, project.id));
  await db.insert(schema.columnTable).values(
    Array.from({ length: 237 }, (_, i) => ({
      id: `column-${i}`,
      projectId: project.id,
      slug: `extra-${i}`,
      name: `Extra ${i}`,
      position: i + 4,
    })),
  );
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Late column task",
      number: 1,
      status: "extra-236",
      description: "Body",
    })
    .returning();
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({ projectId: project.id, type: "github", config: "{}" })
    .returning();
  await db.insert(schema.labelTable).values(
    Array.from({ length: 237 }, (_, i) => ({
      id: `label-${String(i).padStart(3, "0")}`,
      taskId: task.id,
      workspaceId: member.workspace.id,
      name: `Label ${i}`,
      color: "red",
    })),
  );
  await db.insert(schema.externalLinkTable).values(
    Array.from({ length: 203 }, (_, i) => ({
      id: `link-${String(i).padStart(3, "0")}`,
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "issue",
      externalId: String(i),
      url: `https://example.com/issues/${i}`,
      metadata: JSON.stringify({ state: "open" }),
    })),
  );
  mockAuthenticatedSession(member.user);
  return { ...createApp(), member, project, task };
}

describe("bounded board related pages", () => {
  it.each([false, true])(
    "returns bounded rows and all related records on the public=%s path",
    async (isPublic) => {
      const { app, project, task } = await fixture();
      if (isPublic) mockAnonymousSession();
      const labels = new Set<string>();
      const links = new Set<string>();
      const columns = new Set<string>();
      for (let relatedPage = 1; relatedPage <= 3; relatedPage++) {
        const response = await app.request(
          `/api/${isPublic ? "public-project" : "task/tasks"}/${project.id}?relatedPage=${relatedPage}`,
        );
        expect(response.status).toBe(200);
        const json = await response.json();
        const board = isPublic ? json : json.data;
        expect(json.pagination).toMatchObject({
          total: 1,
          totalPages: 1,
          relatedPage,
          relatedTotalPages: 3,
          relatedPageSize: 100,
        });
        expect(board.columns.length).toBeLessThanOrEqual(101);
        const tasks = board.columns.flatMap(
          (column: {
            tasks: {
              id: string;
              labels: { id: string }[];
              externalLinks: { id: string }[];
            }[];
          }) => column.tasks,
        );
        expect(tasks).toHaveLength(1);
        expect(tasks[0].id).toBe(task.id);
        expect(tasks[0].labels.length).toBeLessThanOrEqual(100);
        expect(tasks[0].externalLinks.length).toBeLessThanOrEqual(100);
        for (const value of tasks[0].labels) labels.add(value.id);
        for (const value of tasks[0].externalLinks) links.add(value.id);
        for (const value of board.columns) columns.add(value.id);
      }
      expect(labels.size).toBe(237);
      expect(links.size).toBe(203);
      expect(columns.size).toBe(241);
    },
  );
  it("does not let malformed legacy link metadata break the board", async () => {
    const { project, task } = await fixture();
    for (const metadata of ["broken {", "null", '"primitive"', "[1,2]"]) {
      await db
        .update(schema.externalLinkTable)
        .set({ metadata })
        .where(eq(schema.externalLinkTable.id, "link-000"));
      const response = await getTasks(project.id);
      expect(
        response.data.columns
          .flatMap((column) => column.tasks)
          .find((entry) => entry.id === task.id)?.externalLinks[0]?.metadata,
      ).toBeNull();
    }
  });
  it("rejects other workspaces, revoked public visibility and invalid metadata pages", async () => {
    const { app, project } = await fixture();
    for (const query of [
      "relatedPage=0",
      "relatedPage=-1",
      "relatedPage=1000001",
      "relatedPage=1e4",
    ])
      expect(
        (await app.request(`/api/task/tasks/${project.id}?${query}`)).status,
      ).toBe(400);
    const other = await createWorkspaceMember();
    mockAuthenticatedSession(other.user);
    expect(
      (await app.request(`/api/task/tasks/${project.id}?relatedPage=2`)).status,
    ).toBe(403);
    mockAnonymousSession();
    await db
      .update(schema.projectTable)
      .set({ isPublic: false })
      .where(eq(schema.projectTable.id, project.id));
    expect(
      (await app.request(`/api/public-project/${project.id}?relatedPage=2`))
        .status,
    ).toBe(403);
  });
  it("keeps association counts scoped to the selected task page", async () => {
    const { project } = await fixture();
    await db.insert(schema.taskTable).values({
      projectId: project.id,
      title: "No related records",
      number: 2,
      status: "planned",
    });
    const page = await getTasks(project.id, {
      page: 2,
      limit: 1,
      sortBy: "number",
    });
    expect(page.data.plannedTasks).toHaveLength(1);
    expect(page.data.plannedTasks[0].labels).toEqual([]);
    expect(page.data.plannedTasks[0].externalLinks).toEqual([]);
    expect(page.pagination.totalPages).toBe(2);
  });
  it("limits expensive list queries with a retryable database timeout", async () => {
    const { project } = await fixture();
    const lock = await getDatabasePool().connect();
    try {
      await lock.query("BEGIN");
      await lock.query('LOCK TABLE "task" IN ACCESS EXCLUSIVE MODE');
      await expect(getTasks(project.id)).rejects.toMatchObject({
        status: 503,
        message: "Task list request took too long; retry later",
      });
    } finally {
      await lock.query("ROLLBACK");
      lock.release();
    }
  });
});

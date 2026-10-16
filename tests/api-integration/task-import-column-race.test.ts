import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
import deleteColumn from "../../apps/api/src/column/controllers/delete-column";
import { createApp } from "../../apps/api/src/index";
import importTasks from "../../apps/api/src/task/controllers/import-tasks";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const hooks = vi.hoisted(() => ({ beforePosition: vi.fn(), publish: vi.fn() }));
vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<object>()),
  publishEvent: hooks.publish,
}));
vi.mock(
  "../../apps/api/src/task/controllers/next-task-position",
  async (original) => {
    const actual =
      await original<
        typeof import("../../apps/api/src/task/controllers/next-task-position")
      >();
    return {
      ...actual,
      nextTaskPosition: async (
        ...args: Parameters<typeof actual.nextTaskPosition>
      ) => {
        await hooks.beforePosition();
        return actual.nextTaskPosition(...args);
      },
    };
  },
);

beforeEach(async () => {
  hooks.beforePosition.mockReset();
  hooks.publish.mockReset();
  await resetTestDatabase();
});

async function fixture() {
  const { user, workspace } = await createWorkspaceMember({ role: "owner" });
  return {
    user,
    ...(await createProjectFixture({ workspaceId: workspace.id })),
  };
}

describe("task import column deletion", () => {
  it.each(["done", "Ready to Start"])(
    "keeps %s visible in the backlog when its column disappears after the snapshot",
    async (status) => {
      const { user, project, columns } = await fixture();
      await db
        .update(schema.columnTable)
        .set({ name: "Ready to Start" })
        .where(eq(schema.columnTable.id, columns.done.id));
      hooks.publish.mockImplementationOnce(async () => {
        await deleteColumn(columns.done.id);
      });
      const result = await importTasks(
        project.id,
        [
          { title: "First", status: "to-do" },
          { title: "Second", status },
        ],
        user.id,
      );
      expect(result.results.successful).toBe(2);
      expect(result.results.failed).toBe(0);
      expect(result.results.tasks[1]).toMatchObject({
        task: { status: "planned", columnId: null },
        warnings: [expect.stringContaining('"planned"')],
      });

      mockAuthenticatedSession(user);
      const { app } = createApp();
      const response = await app.request(
        `/api/task/tasks/${project.id}?status=planned`,
      );
      expect(response.status).toBe(200);
      const backlog = await response.json();
      expect(backlog.pagination.total).toBe(1);
      expect(backlog.data.plannedTasks).toMatchObject([
        { title: "Second", status: "planned" },
      ]);
    },
  );

  it("keeps a resolved column valid until its task transaction commits", async () => {
    const { user, project, columns } = await fixture();
    const client = await getDatabasePool().connect();
    const {
      rows: [{ pid }],
    } = await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
    let deletion: Promise<unknown> | undefined;
    try {
      hooks.beforePosition.mockImplementationOnce(async () => {
        deletion = client.query('DELETE FROM "column" WHERE id = $1', [
          columns.done.id,
        ]);
        // This independent connection must wait for the import's column lock.
        await vi.waitFor(
          async () => {
            const activity = await db.execute<{
              wait_event_type: string | null;
            }>(sql`
            SELECT wait_event_type FROM pg_stat_activity WHERE pid = ${pid}
          `);
            expect(activity.rows[0]?.wait_event_type).toBe("Lock");
          },
          { timeout: 2000, interval: 10 },
        );
      });
      const result = await importTasks(
        project.id,
        [{ title: "Concurrent", status: "done" }],
        user.id,
      );
      expect(result.results.successful).toBe(1);
      expect(result.results.failed).toBe(0);
      await deletion;
      const stored = await db
        .select()
        .from(schema.taskTable)
        .where(eq(schema.taskTable.projectId, project.id));
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        title: "Concurrent",
        status: "done",
        columnId: null,
      });
    } finally {
      await deletion?.catch(() => {});
      client.release();
    }
  });
});

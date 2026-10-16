import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
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

  it("rejects deletion of a column that already contains a task", async () => {
    const { user, project, columns } = await fixture();
    const result = await importTasks(
      project.id,
      [{ title: "Existing", status: "done" }],
      user.id,
    );
    expect(result.results.successful).toBe(1);
    hooks.publish.mockClear();
    await expect(deleteColumn(columns.done.id)).rejects.toMatchObject({
      status: 409,
    });
    expect(
      await db.query.columnTable.findFirst({
        where: eq(schema.columnTable.id, columns.done.id),
      }),
    ).toBeDefined();
    expect(hooks.publish).not.toHaveBeenCalled();
  });

  it("rejects a queued deletion when import commits a task into the column", async () => {
    const { user, project, columns } = await fixture();
    let deletion: Promise<{ value: unknown } | { error: unknown }> | undefined;
    try {
      hooks.beforePosition.mockImplementationOnce(async () => {
        deletion = deleteColumn(columns.done.id).then(
          (value) => ({ value }),
          (error: unknown) => ({ error }),
        );
        // The controller must wait for the import's column lock before deciding.
        await vi.waitFor(
          async () => {
            const activity = await db.execute<{
              wait_event_type: string | null;
            }>(sql`
              SELECT wait_event_type FROM pg_stat_activity
              WHERE datname = current_database()
                AND pid <> pg_backend_pid()
                AND wait_event_type = 'Lock'
                AND query LIKE '%"column"%'
                AND (query ILIKE '%delete from%' OR query ILIKE '%for update%')
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
      expect(await deletion).toMatchObject({ error: { status: 409 } });
      expect(
        await db.query.columnTable.findFirst({
          where: eq(schema.columnTable.id, columns.done.id),
        }),
      ).toBeDefined();
      const stored = await db
        .select()
        .from(schema.taskTable)
        .where(eq(schema.taskTable.projectId, project.id));
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        title: "Concurrent",
        status: "done",
        columnId: columns.done.id,
      });

      mockAuthenticatedSession(user);
      const { app } = createApp();
      const response = await app.request(
        `/api/task/tasks/${project.id}?status=done`,
      );
      expect(response.status).toBe(200);
      const board = await response.json();
      expect(board.pagination.total).toBe(1);
      expect(
        board.data.columns.find(
          (column: { slug: string }) => column.slug === "done",
        ),
      ).toMatchObject({ tasks: [{ title: "Concurrent", status: "done" }] });
    } finally {
      await deletion;
    }
  });
});

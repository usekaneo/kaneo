import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const { copyTaskAssetObject, deleteS3Object, publishEvent } = vi.hoisted(
  () => ({
    copyTaskAssetObject: vi.fn(),
    deleteS3Object: vi.fn(async () => undefined),
    publishEvent: vi.fn(async () => undefined),
  }),
);

vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/api/src/storage/s3")>()),
  copyTaskAssetObject,
  deleteS3Object,
}));
// Control both concurrent claims explicitly rather than starting an additional
// subscriber when the test moves the task.
vi.mock("../../apps/api/src/events", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  publishEvent,
}));

import db, { schema } from "../../apps/api/src/database";
import moveTask from "../../apps/api/src/task/controllers/move-task";
import { createNextOccurrence } from "../../apps/api/src/task/recurrence/create-next-occurrence";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("API integration: recurrence during a project move", () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(async () => {
    await resetTestDatabase();
    vi.clearAllMocks();
    copyTaskAssetObject.mockReset();
  });

  it.each([
    { competingClaim: false, undated: false },
    { competingClaim: true, undated: false },
    { competingClaim: false, undated: true },
  ])(
    "rechecks the project after copying assets ($competingClaim competing claim, $undated undated)",
    async ({ competingClaim, undated }) => {
      const member = await createWorkspaceMember();
      const source = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      const destination = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      // The destination uses a different open-column slug, so a retry must
      // reload the workflow as well as the source task.
      await db
        .update(schema.columnTable)
        .set({ slug: "ready" })
        .where(eq(schema.columnTable.id, destination.columns.todo.id));
      const rule = {
        frequency: "weekly",
        interval: 1,
        timeZone: "UTC",
      } as const;
      const assetId = "recurringsourceattachment";
      const [task] = await db
        .insert(schema.taskTable)
        .values({
          projectId: source.project.id,
          columnId: source.columns.done.id,
          status: "done",
          title: "Weekly report",
          number: 1,
          recurrence: rule,
          dueDate: undated ? null : new Date("2026-03-10T00:00:00Z"),
          description: `<img src="/api/asset/${assetId}" />`,
        })
        .returning();
      await db
        .update(schema.projectTable)
        .set({ lastTaskNumber: 1 })
        .where(eq(schema.projectTable.id, source.project.id));
      await db.insert(schema.assetTable).values({
        id: assetId,
        workspaceId: member.workspace.id,
        projectId: source.project.id,
        taskId: task.id,
        objectKey: "source/report.png",
        filename: "report.png",
        mimeType: "image/png",
        size: 100,
        kind: "image",
        surface: "description",
        createdBy: member.user.id,
      });

      let copying!: () => void;
      const copyStarted = new Promise<void>((resolve) => {
        copying = resolve;
      });
      let releaseCopy!: () => void;
      const copyReleased = new Promise<void>((resolve) => {
        releaseCopy = resolve;
      });
      const staleKey = "stale-project/report.png";
      copyTaskAssetObject.mockImplementation(
        async ({ destination: target }) =>
          `${target.projectId}/${target.taskId}/report.png`,
      );
      copyTaskAssetObject.mockImplementationOnce(async () => {
        copying();
        await copyReleased;
        return staleKey;
      });

      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-03-10T23:59:59Z"));
      const occurrence = createNextOccurrence(task.id, member.user.id);
      // Keep rejection handled while the copy is deliberately paused.
      const result = occurrence.then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
      await copyStarted;
      vi.setSystemTime(new Date("2026-03-11T00:00:30Z"));
      try {
        await moveTask({
          taskId: task.id,
          destinationProjectId: destination.project.id,
          destinationStatus: "done",
          currentUserId: member.user.id,
        });
        if (competingClaim) await createNextOccurrence(task.id, member.user.id);
      } finally {
        releaseCopy();
      }
      expect(await result).not.toHaveProperty("error");

      const tasks = await db.query.taskTable.findMany();
      expect(tasks).toHaveLength(2);
      const next = tasks.find((item) => item.id !== task.id);
      expect(next).toMatchObject({
        projectId: destination.project.id,
        columnId: destination.columns.todo.id,
        status: "ready",
        number: 2,
        recurrence: rule,
        dueDate: new Date(
          undated ? "2026-03-17T23:59:59Z" : "2026-03-17T00:00:00Z",
        ),
      });
      expect(tasks.find((item) => item.id === task.id)).toMatchObject({
        projectId: destination.project.id,
        recurrence: null,
      });
      expect(deleteS3Object).toHaveBeenCalledWith(staleKey);
      expect(publishEvent).toHaveBeenCalledWith(
        "task.updated",
        expect.objectContaining({
          taskId: task.id,
          projectId: destination.project.id,
        }),
      );
      const sourceProject = await db.query.projectTable.findFirst({
        where: eq(schema.projectTable.id, source.project.id),
      });
      expect(sourceProject?.lastTaskNumber).toBe(1);
      const assets = await db.query.assetTable.findMany();
      expect(assets).toHaveLength(2);
      expect(
        assets.every((asset) => asset.projectId === destination.project.id),
      ).toBe(true);
      expect(
        assets.find((asset) => asset.taskId === next?.id)?.objectKey,
      ).toContain(destination.project.id);
    },
  );
});

import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { syncLatestTaskValue } from "../../apps/api/src/plugins/github/services/sync-latest-task-value";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock("../../apps/api/src/events", () => ({ publishEvent: vi.fn() }));
beforeEach(resetTestDatabase);

it.each([
  ["closed", "none"],
  ["open", "none"],
  ["closed", "task"],
  ["closed", "binding"],
] as const)(
  "reconciles a late %s completion without another write (changed %s)",
  async (first, changed) => {
    const latest = first === "closed" ? "open" : "closed";
    const status = (state: string) => (state === "closed" ? "done" : "to-do");
    const { workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        number: 1,
        title: "A",
        status: status(first),
      })
      .returning();
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: project.id,
        type: "github",
        config: "{}",
      })
      .returning();
    const [link] = await db
      .insert(schema.externalLinkTable)
      .values({
        taskId: task.id,
        integrationId: integration.id,
        resourceType: "issue",
        externalId: "1",
        url: "https://provider.example/1",
      })
      .returning();
    let started!: () => void;
    const pending = new Promise<void>((resolve) => {
      started = resolve;
    });
    let release!: () => void;
    const response = new Promise<void>((resolve) => {
      release = resolve;
    });
    let remote = latest;
    const write = vi.fn(async (value: string) => {
      remote = value;
      if (value === first) {
        started();
        await response;
      }
      return value === first ? "2026-11-01T00:00:01Z" : "2026-11-01T00:00:02Z";
    });
    const older = syncLatestTaskValue(
      task.id,
      project.id,
      link,
      "state",
      first,
      write,
      async () => {
        // This read happens only in the older completion's repair loop.
        if (changed === "task")
          await db
            .update(schema.taskTable)
            .set({ status: status(first) })
            .where(eq(schema.taskTable.id, task.id));
        if (changed === "binding")
          await db
            .update(schema.integrationTable)
            .set({ config: '{"changed":true}' })
            .where(eq(schema.integrationTable.id, integration.id));
        return remote;
      },
      { type: "github", config: "{}" },
    );
    await pending;
    try {
      await db
        .update(schema.taskTable)
        .set({ status: status(latest) })
        .where(eq(schema.taskTable.id, task.id));
      await syncLatestTaskValue(
        task.id,
        project.id,
        link,
        "state",
        latest,
        write,
      );
    } finally {
      release();
    }
    const result = await older;
    const stored = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.id, link.id),
    });
    const metadata = JSON.parse(stored?.metadata ?? "{}");
    expect(write.mock.calls.map(([value]) => value)).toEqual([first, latest]);
    expect(remote).toBe(latest);
    // Keep both real completions and their exact provider versions; a matching
    // GET must neither invent a third write nor discard echo correlation.
    expect(metadata.lastSync.state.outbound).toHaveLength(2);
    expect(metadata.lastSync.state.outbound).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          updatedAt: "2026-11-01T00:00:01Z",
          pending: false,
        }),
        expect.objectContaining({
          updatedAt: "2026-11-01T00:00:02Z",
          pending: false,
        }),
      ]),
    );
    if (changed === "none") {
      expect(result).toBe(true);
      expect(metadata.state).toBe(latest);
    } else {
      expect(result).not.toBe(true);
      expect(metadata.state).toBe(first);
    }
  },
);

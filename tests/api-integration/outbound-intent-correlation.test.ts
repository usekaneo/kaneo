import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { syncLatestTaskValue } from "../../apps/api/src/plugins/github/services/sync-latest-task-value";
import { withIntegrationLink } from "../../apps/api/src/plugins/github/services/with-integration-link";
import {
  inboundEcho,
  withEchoConfirmation,
} from "../../apps/api/src/plugins/github/utils/inbound-echo";
import type { SyncStamp } from "../../apps/api/src/plugins/github/utils/sync-echo";
import { resetTestDatabase } from "./helpers/database";
import {
  createWorkspaceMember,
  createProjectFixture,
} from "./helpers/fixtures";
beforeEach(resetTestDatabase);
it("commits the waiting provider version before an outbound completion can repair over it", async () => {
  const { workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, number: 1, title: "B" })
    .returning();
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({ projectId: project.id, type: "github", config: "{}" })
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
  let release!: () => void;
  const response = new Promise<void>((resolve) => {
    release = resolve;
  });
  let remote = "A";
  const outbound = syncLatestTaskValue(
    task.id,
    project.id,
    link,
    "title",
    "A",
    async (value) => {
      remote = value;
      await response;
      return "2026-09-30T00:00:01Z";
    },
  );
  await vi.waitFor(async () => {
    const current = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.id, link.id),
    });
    expect(
      JSON.parse(current?.metadata ?? "{}").lastSync?.title?.outbound?.[0]
        .pending,
    ).toBe(true);
  });
  const inbound = withEchoConfirmation(
    async () => remote,
    (current) =>
      withIntegrationLink(
        link,
        integration,
        async (tx, _afterCommit, locked) => {
          const stamp = JSON.parse(locked.metadata ?? "{}").lastSync?.title as
            | SyncStamp
            | undefined;
          if (
            !inboundEcho(stamp, "A", "2026-09-30T00:00:03Z", current, {
              linkId: link.id,
              field: "title",
            })
          )
            await tx
              .update(schema.taskTable)
              .set({ title: "A" })
              .where(eq(schema.taskTable.id, task.id));
        },
      ),
  );
  await vi.waitFor(async () => {
    const current = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.id, link.id),
    });
    expect(
      JSON.parse(current?.metadata ?? "{}").lastSync?.title?.outbound?.[0]
        .observedUpdatedAt,
    ).toBe("2026-09-30T00:00:03Z");
  });
  release();
  await Promise.all([outbound, inbound]);
  expect(
    (
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      })
    )?.title,
  ).toBe("A");
  expect(remote).toBe("A");
});

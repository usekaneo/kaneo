import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { syncLatestTaskValue } from "../../apps/api/src/plugins/github/services/sync-latest-task-value";
import { withIntegrationLink } from "../../apps/api/src/plugins/github/services/with-integration-link";
import {
  inboundEcho,
  withEchoConfirmation,
} from "../../apps/api/src/plugins/github/utils/inbound-echo";
import { updateExternalLink } from "../../apps/api/src/plugins/github/services/link-manager";
import {
  inboundStamp,
  type SyncStamp,
} from "../../apps/api/src/plugins/github/utils/sync-echo";
import { resetTestDatabase } from "./helpers/database";
import {
  createWorkspaceMember,
  createProjectFixture,
} from "./helpers/fixtures";
vi.mock("../../apps/api/src/events", () => ({
  publishEvent: vi.fn(async () => undefined),
}));
beforeEach(resetTestDatabase);
it.each([
  { colliding: false, legitimate: true, timeout: false },
  { colliding: true, legitimate: true, timeout: false },
  { colliding: true, legitimate: false, timeout: false },
  { colliding: true, legitimate: true, timeout: true },
])(
  "correlates observed edits without losing intervening edits (collision=$colliding, legitimate=$legitimate, timeout=$timeout)",
  async ({ colliding, legitimate, timeout }) => {
    const { workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
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
      async () => remote,
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
    const pendingLink = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.id, link.id),
    });
    const pending = JSON.parse(pendingLink?.metadata ?? "{}");
    await updateExternalLink(link.id, {
      metadata: {
        lastSync: {
          title: inboundStamp(pending.lastSync.title, "B", "github"),
        },
      },
    });
    remote = legitimate ? "A" : "B";
    const observedVersion = colliding
      ? "2026-09-30T00:00:01Z"
      : "2026-09-30T00:00:03Z";
    const inbound = withEchoConfirmation(
      async () => remote,
      (current) =>
        withIntegrationLink(
          link,
          integration,
          async (tx, _afterCommit, locked) => {
            const stamp = JSON.parse(locked.metadata ?? "{}").lastSync
              ?.title as SyncStamp | undefined;
            if (
              !inboundEcho(stamp, "A", observedVersion, current, {
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
    const inboundResult = inbound.then(
      () => null,
      (error: unknown) => error,
    );
    await vi.waitFor(async () => {
      const current = await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.id, link.id),
      });
      expect(
        JSON.parse(current?.metadata ?? "{}").lastSync?.title?.outbound?.[0]
          .observedUpdatedAt,
      ).toBe(observedVersion);
    });
    if (timeout) expect(await inboundResult).toBeInstanceOf(Error);
    release();
    await Promise.all([outbound, inboundResult]);
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, task.id),
        })
      )?.title,
    ).toBe(legitimate ? "A" : "B");
    expect(remote).toBe(legitimate ? "A" : "B");
  },
  15000,
);

it("stops correction when a disconnect races the post-response task read", async () => {
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
  let responseReceived = false;
  const findTask = db.query.taskTable.findFirst.bind(db.query.taskTable);
  const read = vi
    .spyOn(db.query.taskTable, "findFirst")
    .mockImplementation(async (options) => {
      if (responseReceived)
        await db
          .delete(schema.externalLinkTable)
          .where(eq(schema.externalLinkTable.id, link.id));
      return findTask(options);
    });
  const write = vi.fn(async () => {
    responseReceived = true;
    return "2026-09-30T00:00:01Z";
  });
  try {
    await syncLatestTaskValue(task.id, project.id, link, "title", "A", write);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("A");
  } finally {
    read.mockRestore();
  }
});

it.each(
  (["title", "description", "state"] as const).flatMap((field) =>
    [false, true].map((aba) => ({ field, aba })),
  ),
)(
  "preserves a newer local $field edit during observed-value HTTP (ABA=$aba)",
  async ({ field, aba }) => {
    const { workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        number: 1,
        title: "B",
        description: "B",
        status: "to-do",
      })
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
    const older = field === "state" ? "closed" : "A";
    const prior = field === "state" ? "open" : "B";
    let first = true;
    let remote = older;
    const write = vi.fn(async (value: string) => {
      remote = value;
      if (!first) return "2026-09-30T00:00:04Z";
      first = false;
      const pending = await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.id, link.id),
      });
      const stamp = JSON.parse(pending?.metadata ?? "{}").lastSync[field];
      await updateExternalLink(link.id, {
        metadata: {
          lastSync: {
            [field]: inboundStamp(
              stamp,
              prior,
              "github",
              "2026-09-30T00:00:02Z",
            ),
          },
        },
        observedOutbound: {
          field,
          intentId: stamp.outbound[0].intentId,
          updatedAt: "2026-09-30T00:00:03Z",
        },
      });
      return "2026-09-30T00:00:01Z";
    });
    await syncLatestTaskValue(
      task.id,
      project.id,
      link,
      field,
      older,
      write,
      async () => {
        const column = field === "state" ? "status" : field;
        await db.transaction(async (tx) => {
          await tx
            .update(schema.taskTable)
            .set({
              [column]: field === "state" ? "in-progress" : "C",
              updatedAt: task.updatedAt,
            })
            .where(eq(schema.taskTable.id, task.id));
          if (aba)
            await tx
              .update(schema.taskTable)
              .set({
                [column]: field === "state" ? "to-do" : "B",
                updatedAt: task.updatedAt,
              })
              .where(eq(schema.taskTable.id, task.id));
        });
        return remote;
      },
    );
    const current = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(field === "state" ? current?.status : current?.[field]).toBe(
      field === "state" ? (aba ? "to-do" : "in-progress") : aba ? "B" : "C",
    );
    expect(remote).toBe(field === "state" ? "open" : aba ? "B" : "C");
    expect(write).toHaveBeenCalledTimes(2);
  },
);

it.each(
  (["github", "gitea"] as const).flatMap((provider) =>
    (["title", "description", "state"] as const).flatMap((field) =>
      ["retry", "read", "apply"].map((phase) => ({ provider, field, phase })),
    ),
  ),
)(
  "stops $field sync against a reconfigured provider ($provider/$phase)",
  async ({ provider, field, phase }) => {
    const { workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        number: 1,
        title: "B",
        description: "B",
        status: "to-do",
      })
      .returning();
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: project.id,
        type: provider,
        config: JSON.stringify({ repositoryName: "old", accessToken: "fake" }),
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
    const older = field === "state" ? "closed" : "A";
    const reconfigure = async () => {
      await db
        .update(schema.integrationTable)
        .set({
          config: JSON.stringify({
            repositoryName: "new",
            accessToken: "fake",
          }),
        })
        .where(eq(schema.integrationTable.id, integration.id));
    };
    const write = vi.fn(async () => {
      if (write.mock.calls.length === 1) {
        if (phase !== "retry") {
          const saved = await db.query.externalLinkTable.findFirst({
            where: eq(schema.externalLinkTable.id, link.id),
          });
          const stamp = JSON.parse(saved!.metadata!).lastSync[field];
          await updateExternalLink(link.id, {
            metadata: {
              lastSync: {
                [field]: inboundStamp(
                  stamp,
                  field === "state" ? "open" : "B",
                  provider,
                  "2026-09-30T00:00:02Z",
                ),
              },
            },
            observedOutbound: {
              field,
              intentId: stamp.outbound[0].intentId,
              updatedAt: "2026-09-30T00:00:03Z",
            },
          });
        }
        if (phase !== "apply") await reconfigure();
      }
      return "2026-09-30T00:00:01Z";
    });
    const read = vi.fn(async () => {
      await reconfigure();
      return older;
    });
    await syncLatestTaskValue(
      task.id,
      project.id,
      link,
      field,
      older,
      write,
      read,
    );
    expect(write).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(phase === "apply" ? 1 : 0);
    const current = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(field === "state" ? current?.status : current?.[field]).toBe(
      field === "state" ? "to-do" : "B",
    );
  },
);
it.each(["github", "gitea"])(
  "rejects a stale provider context before the initial %s write",
  async (provider) => {
    const { workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({ projectId: project.id, number: 1, title: "A" })
      .returning();
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: project.id,
        type: provider,
        config: JSON.stringify({ repositoryName: "new" }),
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
    const write = vi.fn(async () => "2026-09-30T00:00:01Z");
    await syncLatestTaskValue(
      task.id,
      project.id,
      link,
      "title",
      "A",
      write,
      undefined,
      { type: provider, config: JSON.stringify({ repositoryName: "old" }) },
    );
    expect(write).not.toHaveBeenCalled();
  },
);

import { eq, getTableName } from "drizzle-orm";
import { Client } from "pg";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { claimTaskNumber } from "../../apps/api/src/task/controllers/claim-task-numbers";
import type { GiteaConfig } from "../../apps/api/src/plugins/gitea/config";
import { withGiteaOutboundWrite } from "../../apps/api/src/plugins/gitea/services/outbound-fence";
import { handleTaskCommentCreated } from "../../apps/api/src/plugins/gitea/events/task-comment-created";
import { handleTaskStatusChanged } from "../../apps/api/src/plugins/gitea/events/task-status-changed";
import { handleGiteaIssueOpened } from "../../apps/api/src/plugins/gitea/webhooks/issue-opened";
import { syncLatestTaskValue } from "../../apps/api/src/plugins/github/services/sync-latest-task-value";
import { updateExternalLink } from "../../apps/api/src/plugins/github/services/link-manager";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const client = vi.hoisted(() => ({
  createIssueComment: vi.fn(async () => ({ id: 3 })),
  listLabels: vi.fn(async () => [] as Array<{ id: number; name: string }>),
  createLabel: vi.fn(async () => ({ id: 2 })),
  addLabelsToIssue: vi.fn(async () => undefined),
  removeLabelFromIssue: vi.fn(async () => undefined),
  updateIssue: vi.fn(async () => ({ updated_at: "2026-10-02T00:00:00Z" })),
  getIssue: vi.fn(async () => ({ state: "open" })),
}));
vi.mock("../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  createGiteaClient: () => client,
}));
vi.mock("../../apps/api/src/events", () => ({
  publishEvent: vi.fn(async () => undefined),
}));
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  client.listLabels.mockReset().mockResolvedValue([]);
  client.createLabel.mockReset().mockResolvedValue({ id: 2 });
  client.addLabelsToIssue.mockReset().mockResolvedValue(undefined);
  client.removeLabelFromIssue.mockReset().mockResolvedValue(undefined);
});

async function fixture() {
  const { workspace } = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const number = await claimTaskNumber(project.id);
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      number,
      title: "current",
    })
    .returning();
  const config: GiteaConfig = {
    baseUrl: "https://gitea.example",
    accessToken: "test-only",
    repositoryOwner: "owner",
    repositoryName: "repo",
    issueSyncMode: "sync",
  };
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: "gitea",
      config: JSON.stringify(config),
    })
    .returning();
  const [link] = await db
    .insert(schema.externalLinkTable)
    .values({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "issue",
      externalId: "1",
      url: "https://gitea.example/owner/repo/issues/1",
    })
    .returning();
  const binding = {
    integrationId: integration.id,
    projectId: project.id,
    config,
    link: { id: link.id, taskId: task.id, externalId: link.externalId },
  };
  const saveMode = (issueSyncMode: GiteaConfig["issueSyncMode"]) =>
    db
      .update(schema.integrationTable)
      .set({ config: JSON.stringify({ ...config, issueSyncMode }) })
      .where(eq(schema.integrationTable.id, integration.id));
  return {
    project,
    columns,
    task,
    integration,
    link,
    config,
    binding,
    saveMode,
  };
}

it.each(["off", "ingest-only"] as const)(
  "a committed %s save defeats writers carrying an old sync read",
  async (mode) => {
    const f = await fixture();
    await f.saveMode(mode);
    // These callbacks represent distinct single provider mutations, not a composed sequence.
    const create = vi.fn(async () => ({ number: 2 }));
    const comment = vi.fn(async () => ({ id: 3 }));
    const label = vi.fn(async () => undefined);
    expect(
      await withGiteaOutboundWrite(
        { ...f.binding, link: undefined, taskId: f.task.id },
        create,
      ),
    ).toEqual({ sent: false });
    expect(await withGiteaOutboundWrite(f.binding, comment)).toEqual({
      sent: false,
    });
    expect(await withGiteaOutboundWrite(f.binding, label)).toEqual({
      sent: false,
    });
    await handleTaskCommentCreated(
      {
        taskId: f.task.id,
        projectId: f.project.id,
        userId: "test-user",
        comment: "must not send",
      },
      {
        integrationId: f.integration.id,
        projectId: f.project.id,
        config: f.config,
      },
    );
    expect(client.createIssueComment).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(comment).not.toHaveBeenCalled();
    expect(label).not.toHaveBeenCalled();
  },
);

it("holds SHARE through admitted HTTP, blocks the save, and denies the next stale mutation", async () => {
  const f = await fixture();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const writer = new Client({ connectionString: process.env.DATABASE_URL });
  const observer = new Client({ connectionString: process.env.DATABASE_URL });
  await writer.connect();
  await observer.connect();
  const [{ pid }] = (
    await writer.query<{ pid: number }>("select pg_backend_pid() as pid")
  ).rows;
  const admitted = withGiteaOutboundWrite(f.binding, async () => {
    entered.resolve();
    await release.promise;
    return { id: 42 };
  });
  let save: Promise<unknown> | undefined;
  try {
    await entered.promise;
    // Non-key UPDATE distinguishes SHARE from KEY SHARE, which would not fence mode saves.
    save = writer.query(
      `update "${getTableName(schema.integrationTable)}" set config = $1 where id = $2`,
      [JSON.stringify({ ...f.config, issueSyncMode: "off" }), f.integration.id],
    );
    // Observe an actual lock wait: elapsed time and promise noncompletion are not barriers.
    await vi.waitFor(
      async () => {
        const { rows } = await observer.query<{ blocked: boolean }>(
          `
        select exists (
          select 1 from pg_stat_activity waiting
          join pg_locks pending on pending.pid = waiting.pid
          join pg_locks held on held.pid = any(pg_blocking_pids(waiting.pid))
          where waiting.pid = $1 and waiting.wait_event_type = 'Lock'
            and pending.locktype = 'transactionid' and pending.mode = 'ShareLock' and not pending.granted
            and held.locktype = 'relation' and held.relation = $2::regclass
            and held.mode = 'RowShareLock' and held.granted
        ) as blocked`,
          [pid, getTableName(schema.integrationTable)],
        );
        expect(rows[0].blocked).toBe(true);
      },
      { timeout: 5000, interval: 10 },
    );
    // The provider transaction must not hold task/link locks while awaiting HTTP.
    await observer.query("set statement_timeout = '1000ms'");
    await observer.query(
      `update "${getTableName(schema.taskTable)}" set title = $1 where id = $2`,
      ["edited during HTTP", f.task.id],
    );
    await observer.query(
      `update "${getTableName(schema.externalLinkTable)}" set metadata = $1 where id = $2`,
      [JSON.stringify({ marker: "inbound during HTTP" }), f.link.id],
    );
    release.resolve();
    expect(await admitted).toEqual({ sent: true, value: { id: 42 } });
    await save;
    const nextLabelMutation = vi.fn(async () => undefined);
    expect(await withGiteaOutboundWrite(f.binding, nextLabelMutation)).toEqual({
      sent: false,
    });
    expect(nextLabelMutation).not.toHaveBeenCalled();
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, f.task.id),
        })
      )?.title,
    ).toBe("edited during HTTP");
  } finally {
    release.resolve();
    await admitted.catch(() => undefined);
    await save?.catch(() => undefined);
    await writer.end();
    await observer.end();
  }
}, 15000);

it("releases the integration lock after a provider failure", async () => {
  const f = await fixture();
  const failure = new Error("provider connection failed");
  await expect(
    withGiteaOutboundWrite(f.binding, async () => {
      throw failure;
    }),
  ).rejects.toBe(failure);
  const connection = new Client({ connectionString: process.env.DATABASE_URL });
  await connection.connect();
  try {
    await connection.query("set statement_timeout = '1000ms'");
    const saved = await connection.query(
      `update "${getTableName(schema.integrationTable)}" set config = $1 where id = $2 returning config`,
      [JSON.stringify({ ...f.config, issueSyncMode: "off" }), f.integration.id],
    );
    expect(JSON.parse(saved.rows[0].config).issueSyncMode).toBe("off");
    const retry = vi.fn(async () => undefined);
    expect(await withGiteaOutboundWrite(f.binding, retry)).toEqual({
      sent: false,
    });
    expect(retry).not.toHaveBeenCalled();
  } finally {
    await connection.end();
  }
});

it("a sync/off/sync cycle cannot resurrect a retired write intent or schedule uncertain repair", async () => {
  const f = await fixture();
  const pending = Promise.withResolvers<string>();
  const proceed = Promise.withResolvers<void>();
  const provider = vi.fn(async () => ({ updatedAt: "2026-10-02T00:00:00Z" }));
  const readCurrent = vi.fn(async () => "provider value");
  const outbound = syncLatestTaskValue(
    f.task.id,
    f.project.id,
    f.link,
    "title",
    "old value",
    async (_value, intentId) => {
      pending.resolve(intentId);
      await proceed.promise;
      const result = await withGiteaOutboundWrite(
        { ...f.binding, intent: { field: "title", intentId } },
        provider,
      );
      return result.sent
        ? { sent: true, updatedAt: result.value.updatedAt }
        : { sent: false };
    },
    readCurrent,
    { type: "gitea", config: f.integration.config },
  );
  try {
    const intentId = await pending.promise;
    await f.saveMode("off");
    // Mode-save retirement is the durable ABA guard; re-enabling restores the same config.
    await updateExternalLink(f.link.id, {
      retireOutboundIntents: { field: "title", intentIds: [intentId] },
    });
    await updateExternalLink(f.link.id, {
      outbound: {
        field: "title",
        value: "new value",
        intentId: "newer-intent",
        pending: true,
      },
    });
    await f.saveMode("sync");
    proceed.resolve();
    await outbound;
    expect(provider).not.toHaveBeenCalled();
    expect(readCurrent).not.toHaveBeenCalled();
    const current = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.id, f.link.id),
    });
    const metadata = JSON.parse(current?.metadata ?? "{}");
    expect(metadata.lastSync.title.outbound).toEqual([
      expect.objectContaining({
        intentId,
        pending: false,
        uncertain: false,
        cancelled: true,
      }),
      expect.objectContaining({ intentId: "newer-intent", pending: true }),
    ]);
    expect(metadata.deferredIssueEdit).toBeUndefined();
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, f.task.id),
        })
      )?.title,
    ).toBe("current");
  } finally {
    proceed.resolve();
    await outbound.catch(() => undefined);
  }
});

it.each(["inactive", "rebound", "moved", "unlinked", "retargeted"] as const)(
  "rejects an old writer whose binding is $0",
  async (change) => {
    const f = await fixture();
    if (change === "inactive")
      await db
        .update(schema.integrationTable)
        .set({ isActive: false })
        .where(eq(schema.integrationTable.id, f.integration.id));
    if (change === "rebound")
      await db
        .update(schema.integrationTable)
        .set({
          config: JSON.stringify({ ...f.config, repositoryName: "other" }),
        })
        .where(eq(schema.integrationTable.id, f.integration.id));
    if (change === "moved") {
      const { project } = await createProjectFixture({
        workspaceId: f.project.workspaceId,
      });
      await db
        .update(schema.taskTable)
        .set({ projectId: project.id })
        .where(eq(schema.taskTable.id, f.task.id));
    }
    if (change === "unlinked")
      await db
        .delete(schema.externalLinkTable)
        .where(eq(schema.externalLinkTable.id, f.link.id));
    if (change === "retargeted")
      await db
        .update(schema.externalLinkTable)
        .set({ externalId: "2" })
        .where(eq(schema.externalLinkTable.id, f.link.id));
    const provider = vi.fn(async () => undefined);
    expect(await withGiteaOutboundWrite(f.binding, provider)).toEqual({
      sent: false,
    });
    expect(provider).not.toHaveBeenCalled();
  },
);

it.each([false, true])(
  "a retired admitted intent rejects late completion metadata (cancelled=%s)",
  async (cancelled) => {
    const f = await fixture();
    const intentId = "admitted-intent";
    await updateExternalLink(f.link.id, {
      outbound: { field: "title", value: "old value", intentId, pending: true },
    });
    expect(
      await withGiteaOutboundWrite(
        { ...f.binding, intent: { field: "title", intentId } },
        async () => "provider response",
      ),
    ).toEqual({ sent: true, value: "provider response" });
    await f.saveMode("off");
    await updateExternalLink(f.link.id, {
      retireOutboundIntents: { field: "title", intentIds: [intentId] },
    });
    await updateExternalLink(f.link.id, {
      outbound: {
        field: "title",
        value: "new value",
        intentId: "newer-intent",
        pending: true,
      },
    });
    await f.saveMode("sync");
    expect(
      await updateExternalLink(f.link.id, {
        requireOutboundIntent: { field: "title", intentId },
        title: "old value",
        outbound: {
          field: "title",
          value: "old value",
          intentId,
          pending: false,
          cancelled,
          uncertain: !cancelled,
        },
      }),
    ).toBe(false);
    const current = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.id, f.link.id),
    });
    const metadata = JSON.parse(current?.metadata ?? "{}");
    expect(current?.title).not.toBe("old value");
    expect(metadata.lastSync.title.source).toBeUndefined();
    expect(metadata.lastSync.title.outbound).toEqual([
      expect.objectContaining({
        intentId,
        pending: false,
        uncertain: false,
        cancelled: true,
      }),
      expect.objectContaining({ intentId: "newer-intent", pending: true }),
    ]);
  },
);

async function statusChange(
  f: {
    task: { id: string };
    project: { id: string };
    columns: { done: { id: string }; todo: { id: string } };
  },
  newStatus: "done" | "to-do",
) {
  await db
    .update(schema.taskTable)
    .set({
      status: newStatus,
      columnId: newStatus === "done" ? f.columns.done.id : f.columns.todo.id,
    })
    .where(eq(schema.taskTable.id, f.task.id));
  return {
    taskId: f.task.id,
    projectId: f.project.id,
    userId: "test-user",
    oldStatus: newStatus === "done" ? "to-do" : "done",
    newStatus,
  };
}

function issueOpenedPayload() {
  return {
    action: "opened",
    issue: {
      number: 42,
      title: "Imported issue",
      body: "Provider description",
      html_url: "https://gitea.example/owner/repo/issues/42",
      // Normalization requires adding status:to-do despite the incoming label.
      labels: ["status:TO-DO"],
      user: { login: "reporter" },
    },
    repository: {
      owner: { login: "owner" },
      name: "repo",
      html_url: "https://gitea.example/owner/repo",
    },
  };
}

describe.each(["done", "to-do"] as const)(
  "label failures while changing status to %s",
  (newStatus) => {
    it.each([
      "listLabels",
      "createLabel",
      "addLabelsToIssue",
      "removeLabelFromIssue",
    ] as const)(
      `status ${newStatus} still changes provider state after %s fails`,
      async (operation) => {
        const f = await fixture();
        const event = await statusChange(f, newStatus);
        client.listLabels.mockResolvedValue([
          { id: 1, name: `status:${event.oldStatus}` },
        ]);
        const failure = new Error(`${operation} unavailable`);
        client[operation].mockRejectedValueOnce(failure);
        const errors = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
          await handleTaskStatusChanged(event, {
            integrationId: f.integration.id,
            projectId: f.project.id,
            config: f.config,
          });
          expect(client[operation]).toHaveBeenCalled();
          expect(client.updateIssue).toHaveBeenCalledExactlyOnceWith(
            "owner",
            "repo",
            1,
            { state: newStatus === "done" ? "closed" : "open" },
          );
          const link = await db.query.externalLinkTable.findFirst({
            where: eq(schema.externalLinkTable.id, f.link.id),
          });
          expect(JSON.parse(link?.metadata ?? "{}").state).toBe(
            newStatus === "done" ? "closed" : "open",
          );
        } finally {
          errors.mockRestore();
        }
      },
    );
  },
);

it.each(["off", "ingest-only"] as const)(
  "status handler carrying stale sync config stops all writes after %s commits",
  async (mode) => {
    const f = await fixture();
    const event = await statusChange(f, "done");
    client.listLabels.mockResolvedValue([{ id: 1, name: "status:to-do" }]);
    await f.saveMode(mode);
    await handleTaskStatusChanged(event, {
      integrationId: f.integration.id,
      projectId: f.project.id,
      config: f.config,
    });
    expect(client.removeLabelFromIssue).not.toHaveBeenCalled();
    expect(client.createLabel).not.toHaveBeenCalled();
    expect(client.addLabelsToIssue).not.toHaveBeenCalled();
    expect(client.updateIssue).not.toHaveBeenCalled();
  },
);

it.each(["listLabels", "createLabel", "addLabelsToIssue"] as const)(
  "issue-opened still sends its task backlink after %s fails",
  async (operation) => {
    const f = await fixture();
    client[operation].mockRejectedValueOnce(
      new Error(`${operation} unavailable`),
    );
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await handleGiteaIssueOpened(issueOpenedPayload(), f.integration.id);
      const link = await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.externalId, "42"),
        with: { task: true },
      });
      expect(link?.task?.title).toBe("Imported issue");
      expect(client[operation]).toHaveBeenCalled();
      expect(client.createIssueComment).toHaveBeenCalledExactlyOnceWith(
        "owner",
        "repo",
        42,
        expect.stringContaining(
          `/project/${f.project.id}/task/${link?.taskId})`,
        ),
      );
    } finally {
      errors.mockRestore();
    }
  },
);

it("issue-opened stops before the backlink when its label fence is skipped", async () => {
  const f = await fixture();
  client.listLabels.mockImplementationOnce(async () => {
    await f.saveMode("off");
    return [];
  });
  await handleGiteaIssueOpened(issueOpenedPayload(), f.integration.id);
  const link = await db.query.externalLinkTable.findFirst({
    where: eq(schema.externalLinkTable.externalId, "42"),
  });
  expect(link?.taskId).toEqual(expect.any(String));
  expect(client.listLabels).toHaveBeenCalledExactlyOnceWith("owner", "repo");
  expect(client.createLabel).not.toHaveBeenCalled();
  expect(client.addLabelsToIssue).not.toHaveBeenCalled();
  expect(client.createIssueComment).not.toHaveBeenCalled();
});

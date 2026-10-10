import { eq, sql } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { updateExternalLink } from "../../apps/api/src/plugins/github/services/link-manager";
import type { IntegrationDatabase } from "../../apps/api/src/plugins/github/services/integration-task-scope";
import type { DeferredIssueEdit } from "../../apps/api/src/plugins/github/utils/deferred-issue-edit";
import {
  inboundStamp,
  outboundStamp,
  type SyncStamp,
} from "../../apps/api/src/plugins/github/utils/sync-echo";
import type {
  GiteaConfig,
  GiteaIssueSyncMode,
} from "../../apps/api/src/plugins/gitea/config";
import { retireGiteaIssueEdits } from "../../apps/api/src/plugins/gitea/services/retire-issue-edits";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type Metadata = Record<string, unknown> & {
  deferredIssueEdit?: DeferredIssueEdit;
  lastSync?: Record<string, SyncStamp>;
};

beforeEach(resetTestDatabase);

function issueMetadata(index: number): Metadata {
  const lastSync: Record<string, SyncStamp> = {};
  for (const field of ["title", "description", "state"] as const) {
    let stamp = inboundStamp(
      undefined,
      `provider-${field}`,
      "gitea",
      "2026-10-01T00:00:00Z",
    );
    stamp = outboundStamp(stamp, `completed-${field}`, "2026-10-02T00:00:00Z", {
      intentId: `${index}-${field}-completed`,
      pending: false,
      uncertain: false,
      observedUpdatedAt: "2026-10-01T00:00:00Z",
    });
    if (index % 4 !== 3) {
      stamp = outboundStamp(stamp, `pending-${field}`, undefined, {
        intentId: `${index}-${field}-pending`,
        pending: true,
      });
      stamp = outboundStamp(stamp, `uncertain-${field}`, undefined, {
        intentId: `${index}-${field}-uncertain`,
        uncertain: true,
      });
      stamp = outboundStamp(stamp, `cancelled-${field}`, undefined, {
        intentId: `${index}-${field}-cancelled`,
        cancelled: true,
        pending: true,
        uncertain: true,
      });
      stamp = outboundStamp(stamp, `legacy-pending-${field}`, undefined, {
        pending: true,
      });
      stamp = outboundStamp(stamp, `legacy-uncertain-${field}`, undefined, {
        uncertain: true,
      });
    }
    lastSync[field] = stamp;
  }
  lastSync.labels = { source: "gitea", value: "unrelated-field" };
  const metadata: Metadata = {
    lastSync,
    syncFilterPaused: true,
    providerIdentity: { owner: "owner", repository: "repo", index },
    retained: {
      payload: "unrelated-metadata-".repeat(256),
      nested: [index, { keep: true }],
    },
  };
  if (index % 4 !== 3) {
    metadata.deferredIssueEdit = {
      id: `job-${index}`,
      scope: `scope-${index}`,
      fields: index % 4 === 2 ? [] : ["title", "state"],
      ...(index % 4 !== 0
        ? { repairFields: ["description"] as DeferredIssueEdit["repairFields"] }
        : {}),
    };
  }
  return metadata;
}

async function fixture(count = 1) {
  const { workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const config: GiteaConfig = {
    baseUrl: "https://gitea.example",
    accessToken: "test-only",
    repositoryOwner: "owner",
    repositoryName: "repo",
    issueSyncMode: "sync",
  };
  const [integration, otherIntegration] = await db
    .insert(schema.integrationTable)
    .values([
      { projectId: project.id, type: "gitea", config: JSON.stringify(config) },
      {
        projectId: project.id,
        type: "github",
        config: JSON.stringify({
          repositoryOwner: "owner",
          repositoryName: "other",
        }),
      },
    ])
    .returning();
  const tasks = await db
    .insert(schema.taskTable)
    .values(
      Array.from({ length: count }, (_, index) => ({
        projectId: project.id,
        number: index + 1,
        title: `Retirement task ${index}`,
      })),
    )
    .returning();
  const initial = tasks.map((_, index) => issueMetadata(index));
  const links = await db
    .insert(schema.externalLinkTable)
    .values(
      tasks.map((task, index) => ({
        taskId: task.id,
        integrationId: integration!.id,
        resourceType: "issue",
        externalId: String(index + 1),
        url: `https://gitea.example/owner/repo/issues/${index + 1}`,
        metadata: JSON.stringify(initial[index]),
      })),
    )
    .returning();
  const controls = await db
    .insert(schema.externalLinkTable)
    .values([
      ...["pull_request", "branch"].map((resourceType) => ({
        taskId: tasks[0]!.id,
        integrationId: integration!.id,
        resourceType,
        externalId: "control",
        url: "https://gitea.example/control",
        metadata: JSON.stringify(issueMetadata(0)),
      })),
      {
        taskId: tasks[0]!.id,
        integrationId: otherIntegration!.id,
        resourceType: "issue",
        externalId: "control",
        url: "https://github.example/control",
        metadata: JSON.stringify(issueMetadata(0)),
      },
      {
        taskId: tasks[0]!.id,
        integrationId: integration!.id,
        resourceType: "issue",
        externalId: "empty",
        url: "https://gitea.example/empty",
        metadata: null,
      },
      {
        taskId: tasks[0]!.id,
        integrationId: integration!.id,
        resourceType: "issue",
        externalId: "invalid-job",
        url: "https://gitea.example/invalid-job",
        metadata: JSON.stringify({
          retained: "invalid job is unrelated metadata",
          deferredIssueEdit: {
            id: "invalid",
            fields: ["unknown"],
            scope: "scope",
          },
        }),
      },
    ])
    .returning();
  return {
    integration: integration!,
    otherIntegration: otherIntegration!,
    links,
    controls,
    initial,
    config,
  };
}

async function saveMode(
  integrationId: string,
  mode: GiteaIssueSyncMode,
  tx: IntegrationDatabase,
) {
  const [integration] = await tx
    .select()
    .from(schema.integrationTable)
    .where(eq(schema.integrationTable.id, integrationId))
    .for("update");
  await tx
    .update(schema.integrationTable)
    .set({
      config: JSON.stringify({
        ...JSON.parse(integration!.config),
        issueSyncMode: mode,
      }),
    })
    .where(eq(schema.integrationTable.id, integrationId));
  await retireGiteaIssueEdits(integrationId, tx, mode);
}

async function readLinks() {
  return db
    .select({
      id: schema.externalLinkTable.id,
      metadata: schema.externalLinkTable.metadata,
      revision: sql<string>`${schema.externalLinkTable}.xmin::text`,
    })
    .from(schema.externalLinkTable)
    .orderBy(schema.externalLinkTable.id);
}

function expectedRetirement(
  before: Metadata,
  mode: GiteaIssueSyncMode,
): Metadata {
  const expected: Metadata = structuredClone(before);
  if (before.deferredIssueEdit) {
    delete expected.deferredIssueEdit;
    if (mode === "ingest-only" && before.deferredIssueEdit.fields.length) {
      expected.deferredIssueEdit = {
        id: expect.any(String),
        scope: before.deferredIssueEdit.scope,
        fields: before.deferredIssueEdit.fields,
      };
    }
  }
  for (const field of ["title", "description", "state"] as const) {
    const stamp = expected.lastSync?.[field];
    if (stamp)
      stamp.outbound = stamp.outbound?.map((entry) =>
        entry.intentId && !entry.cancelled && (entry.pending || entry.uncertain)
          ? { ...entry, pending: false, uncertain: false, cancelled: true }
          : entry,
      );
  }
  return expected;
}

it.each(["ingest-only", "off"] as const)(
  "%s retirement preserves large project receipts and unrelated metadata atomically",
  async (mode) => {
    const f = await fixture(240);
    const before = new Map((await readLinks()).map((link) => [link.id, link]));
    await db.transaction((tx) => saveMode(f.integration.id, mode, tx));
    const after = new Map((await readLinks()).map((link) => [link.id, link]));
    expect(after.size).toBe(before.size);
    for (const [index, link] of f.links.entries()) {
      const metadata: Metadata = JSON.parse(after.get(link.id)!.metadata!);
      expect(metadata).toEqual(expectedRetirement(f.initial[index]!, mode));
      if (metadata.deferredIssueEdit) {
        expect(metadata.deferredIssueEdit.id).not.toBe(
          f.initial[index]!.deferredIssueEdit!.id,
        );
        expect(metadata.deferredIssueEdit.repairFields).toBeUndefined();
      }
      if (index % 4 === 3)
        expect(after.get(link.id)).toEqual(before.get(link.id));
    }
    for (const control of f.controls)
      expect(after.get(control.id)).toEqual(before.get(control.id));
    expect(
      (await db.query.integrationTable.findFirst({
        where: eq(schema.integrationTable.id, f.otherIntegration.id),
      }))!.config,
    ).toBe(f.otherIntegration.config);
    const integration = await db.query.integrationTable.findFirst({
      where: eq(schema.integrationTable.id, f.integration.id),
    });
    expect(JSON.parse(integration!.config).issueSyncMode).toBe(mode);
  },
);

it.each(["ingest-only", "off"] as const)(
  "%s retirement rolls back every link together with its integration settings",
  async (mode) => {
    const f = await fixture(64);
    const before = await readLinks();
    const failure = new Error("Abort settings transaction after retirement");
    await expect(
      db.transaction(async (tx) => {
        await saveMode(f.integration.id, mode, tx);
        const links = await tx.query.externalLinkTable.findMany({
          where: eq(schema.externalLinkTable.integrationId, f.integration.id),
        });
        const first = links.find((link) => link.id === f.links[0]!.id)!;
        expect(JSON.parse(first.metadata!)).toEqual(
          expectedRetirement(f.initial[0]!, mode),
        );
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(await readLinks()).toEqual(before);
    expect(
      (await db.query.integrationTable.findFirst({
        where: eq(schema.integrationTable.id, f.integration.id),
      }))!.config,
    ).toBe(f.integration.config);
  },
);

it.each(["ingest-only", "off"] as const)(
  "%s retirement reads a concurrent committed metadata update after acquiring its link lock",
  async (mode) => {
    const f = await fixture();
    const link = f.links[0]!;
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const started = Promise.withResolvers<number>();
    const mutation = db.transaction(async (tx) => {
      await updateExternalLink(
        link.id,
        { metadata: { concurrent: { preserved: true } } },
        tx,
      );
      entered.resolve();
      await release.promise;
    });
    await entered.promise;
    const retirement = db.transaction(async (tx) => {
      const connection = await tx.execute<{ pid: number }>(
        sql`select pg_backend_pid() as pid`,
      );
      started.resolve(connection.rows[0]!.pid);
      await saveMode(f.integration.id, mode, tx);
    });
    try {
      const pid = await started.promise;
      await vi.waitFor(async () => {
        const blocked = await db.execute<{ waiting: boolean }>(
          sql`select cardinality(pg_blocking_pids(${pid})) > 0 as waiting`,
        );
        expect(blocked.rows[0]!.waiting).toBe(true);
      });
    } finally {
      release.resolve();
      await Promise.all([mutation, retirement]);
    }
    const saved = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.id, link.id),
    });
    expect(JSON.parse(saved!.metadata!)).toEqual({
      ...expectedRetirement(f.initial[0]!, mode),
      concurrent: { preserved: true },
    });
  },
);

it("a metadata writer queued behind retirement preserves cancelled intents and retained inbound work", async () => {
  const f = await fixture();
  const link = f.links[0]!;
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const started = Promise.withResolvers<number>();
  const retirement = db.transaction(async (tx) => {
    await saveMode(f.integration.id, "ingest-only", tx);
    entered.resolve();
    await release.promise;
  });
  await entered.promise;
  const mutation = db.transaction(async (tx) => {
    const connection = await tx.execute<{ pid: number }>(
      sql`select pg_backend_pid() as pid`,
    );
    started.resolve(connection.rows[0]!.pid);
    await updateExternalLink(
      link.id,
      { metadata: { concurrent: { preserved: true } } },
      tx,
    );
  });
  try {
    const pid = await started.promise;
    await vi.waitFor(async () => {
      const blocked = await db.execute<{ waiting: boolean }>(
        sql`select cardinality(pg_blocking_pids(${pid})) > 0 as waiting`,
      );
      expect(blocked.rows[0]!.waiting).toBe(true);
    });
  } finally {
    release.resolve();
    await Promise.all([retirement, mutation]);
  }
  const saved = await db.query.externalLinkTable.findFirst({
    where: eq(schema.externalLinkTable.id, link.id),
  });
  expect(JSON.parse(saved!.metadata!)).toEqual({
    ...expectedRetirement(f.initial[0]!, "ingest-only"),
    concurrent: { preserved: true },
  });
});

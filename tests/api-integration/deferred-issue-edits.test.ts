import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { publishEvent } from "../../apps/api/src/events";
import {
  deferIssueEdit,
  replayDeferredIssueEdits,
} from "../../apps/api/src/plugins/github/services/deferred-issue-edits";
import { deferTaskSync } from "../../apps/api/src/plugins/github/services/defer-issue-edit";
import { syncLatestTaskValue } from "../../apps/api/src/plugins/github/services/sync-latest-task-value";
import { updateExternalLink } from "../../apps/api/src/plugins/github/services/link-manager";
import { handleGiteaIssueEdited } from "../../apps/api/src/plugins/gitea/webhooks/issue-edited";
import { handleIssueEdited } from "../../apps/api/src/plugins/github/webhooks/issue-edited";
import { handleIssueClosed } from "../../apps/api/src/plugins/github/webhooks/issue-closed";
import { handleIssueReopened } from "../../apps/api/src/plugins/github/webhooks/issue-reopened";
import { handleGiteaIssueClosed } from "../../apps/api/src/plugins/gitea/webhooks/issue-closed";
import { handleGiteaIssueReopened } from "../../apps/api/src/plugins/gitea/webhooks/issue-reopened";
import {
  inboundStamp,
  outboundStamp,
} from "../../apps/api/src/plugins/github/utils/sync-echo";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
const m = vi.hoisted(() => ({
  integrations: [] as unknown[],
  read: vi.fn(),
  write: vi.fn(),
}));
vi.mock("../../apps/api/src/events", () => ({
  publishEvent: vi.fn(async () => undefined),
}));
vi.mock(
  "../../apps/api/src/plugins/github/services/task-service",
  async (original) => ({
    ...(await original<
      typeof import("../../apps/api/src/plugins/github/services/task-service")
    >()),
    findAllIntegrationsByRepo: async () => m.integrations,
  }),
);
vi.mock("../../apps/api/src/plugins/github/utils/github-app", () => ({
  getVerifiedInstallationOctokit: async () => ({
    rest: {
      issues: {
        get: async () => ({ data: await m.read() }),
        update: async (params: Record<string, unknown>) => ({
          data: await m.write(params),
        }),
      },
    },
  }),
}));
vi.mock("../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  createGiteaClient: () => ({
    getIssue: () => m.read(),
    updateIssue: (
      _owner: string,
      _repo: string,
      _number: number,
      params: Record<string, unknown>,
    ) => m.write(params),
  }),
}));
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  m.write.mockReset().mockResolvedValue({ updated_at: "2026-09-30T00:00:04Z" });
  m.read.mockReset().mockResolvedValue({
    title: "A",
    body: "recovered body",
    state: "closed",
    updated_at: "2026-09-30T00:00:03Z",
  });
});
async function seed(type = "github") {
  const { workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      number: 1,
      title: "B",
      description: "old body",
      status: "to-do",
    })
    .returning();
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type,
      config: JSON.stringify({
        baseUrl: "https://git.example",
        repositoryOwner: "owner",
        repositoryName: "repo",
        installationId: 10,
        repositoryId: 20,
        accessToken: "test-secret-never-metadata",
      }),
    })
    .returning();
  const stamp = inboundStamp(
    outboundStamp(undefined, "A", undefined, {
      intentId: "dead-writer",
      pending: true,
    }),
    "B",
    type,
  );
  const [link] = await db
    .insert(schema.externalLinkTable)
    .values({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "issue",
      externalId: "1",
      url: "https://git.example/owner/repo/issues/1",
      metadata: JSON.stringify({ lastSync: { title: stamp } }),
    })
    .returning();
  m.integrations = [integration];
  return { project, task, integration, link };
}
async function metadata(linkId: string) {
  const link = await db.query.externalLinkTable.findFirst({
    where: eq(schema.externalLinkTable.id, linkId),
  });
  return JSON.parse(link?.metadata ?? "{}");
}
async function current(taskId: string) {
  return db.query.taskTable.findFirst({
    where: eq(schema.taskTable.id, taskId),
  });
}
it("durably acknowledges an orphaned delivery and later recovers every changed field", async () => {
  const { task, integration, link } = await seed();
  await handleIssueEdited({
    action: "edited",
    issue: {
      number: 1,
      title: "A",
      body: "recovered body",
      html_url: link.url,
      updated_at: "2026-09-30T00:00:03Z",
    },
    changes: { title: { from: "B" }, body: { from: "old body" } },
    repository: {
      id: 20,
      owner: { login: "owner" },
      name: "repo",
      full_name: "owner/repo",
    },
  });
  const queued = await metadata(link.id);
  expect(queued.deferredIssueEdit.fields).toEqual(["title", "description"]);
  expect(JSON.stringify(queued)).not.toContain("test-secret-never-metadata");
  expect(JSON.stringify(queued)).not.toContain("recovered body");
  expect((await current(task.id))?.title).toBe("B");
  await replayDeferredIssueEdits();
  expect(m.read).not.toHaveBeenCalled();
  queued.lastSync.title.outbound[0].timestamp = new Date(
    Date.now() - 300_001,
  ).toISOString();
  await db
    .update(schema.externalLinkTable)
    .set({ metadata: JSON.stringify(queued) })
    .where(eq(schema.externalLinkTable.id, link.id));
  await replayDeferredIssueEdits();
  expect(await current(task.id)).toMatchObject({
    title: "A",
    description: "recovered body",
  });
  expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
  expect(publishEvent).toHaveBeenCalledWith("task.updated", {
    taskId: task.id,
    projectId: integration.projectId,
  });
}, 15_000);
it.each(["github", "gitea"])(
  "recovers orphaned %s state through project workflows",
  async (type) => {
    const { task, integration, link } = await seed(type);
    await deferIssueEdit(link, integration, ["state"]);
    await replayDeferredIssueEdits();
    expect((await current(task.id))?.status).toBe("done");
    expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
    expect(publishEvent).toHaveBeenCalledWith(
      "task.status_changed",
      expect.objectContaining({
        taskId: task.id,
        oldStatus: "to-do",
        newStatus: "done",
      }),
    );
  },
);
it("retains failed provider reads and retries without sender redelivery", async () => {
  const { task, integration, link } = await seed();
  await deferIssueEdit(link, integration, ["description"]);
  m.read.mockRejectedValueOnce(new Error("provider unavailable"));
  expect(await replayDeferredIssueEdits()).toEqual({ degraded: true });
  expect((await metadata(link.id)).deferredIssueEdit.fields).toEqual([
    "description",
  ]);
  await replayDeferredIssueEdits();
  expect((await current(task.id))?.description).toBe("recovered body");
  expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
});
it("does not clear fields queued concurrently with a provider read", async () => {
  const { task, integration, link } = await seed();
  await deferIssueEdit(link, integration, ["state"]);
  m.read.mockImplementationOnce(async () => {
    await deferIssueEdit(link, integration, ["description"]);
    return { title: "A", body: "stale read", state: "closed" };
  });
  await replayDeferredIssueEdits();
  expect(await current(task.id)).toMatchObject({
    status: "to-do",
    description: "old body",
  });
  expect((await metadata(link.id)).deferredIssueEdit.fields).toEqual([
    "state",
    "description",
  ]);
  await replayDeferredIssueEdits();
  expect(await current(task.id)).toMatchObject({
    status: "done",
    description: "recovered body",
  });
});
it.each(["disabled", "rebound", "moved"])(
  "guards deferred edits when their integration is %s during HTTP",
  async (change) => {
    const { project, task, integration, link } = await seed();
    await deferIssueEdit(link, integration, ["description"]);
    m.read.mockImplementationOnce(async () => {
      if (change === "moved") {
        const other = await createProjectFixture({
          workspaceId: project.workspaceId,
        });
        await db
          .update(schema.taskTable)
          .set({ projectId: other.project.id })
          .where(eq(schema.taskTable.id, task.id));
      } else {
        await db
          .update(schema.integrationTable)
          .set(
            change === "disabled"
              ? { isActive: false }
              : {
                  config: JSON.stringify({
                    ...JSON.parse(integration.config),
                    repositoryName: "other",
                  }),
                },
          )
          .where(eq(schema.integrationTable.id, integration.id));
      }
      return { title: "A", body: "wrong source", state: "closed" };
    });
    await replayDeferredIssueEdits();
    expect((await current(task.id))?.description).toBe("old body");
    expect(publishEvent).not.toHaveBeenCalled();
    if (change !== "moved") {
      await replayDeferredIssueEdits();
      expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
    }
  },
);
it("rechecks provider state after a newer inbound edit during HTTP", async () => {
  const { task, integration, link } = await seed();
  await deferIssueEdit(link, integration, ["description"]);
  m.read.mockImplementationOnce(async () => {
    await db
      .update(schema.taskTable)
      .set({ description: "newer edit" })
      .where(eq(schema.taskTable.id, task.id));
    await updateExternalLink(link.id, {
      metadata: {
        lastSync: {
          description: inboundStamp(undefined, "newer edit", "github"),
        },
      },
    });
    return { title: "A", body: "stale read", state: "closed" };
  });
  await replayDeferredIssueEdits();
  expect((await current(task.id))?.description).toBe("newer edit");
  expect((await metadata(link.id)).deferredIssueEdit).toBeDefined();
  m.read.mockResolvedValueOnce({
    title: "A",
    body: "newer edit",
    state: "closed",
  });
  await replayDeferredIssueEdits();
  expect((await current(task.id))?.description).toBe("newer edit");
  expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
});

it("retains deferred edits across credential rotation on the same repository", async () => {
  const { task, integration, link } = await seed("gitea");
  await db
    .update(schema.integrationTable)
    .set({
      config: JSON.stringify({
        ...JSON.parse(integration.config),
        accessToken: "rotated-test-secret",
      }),
    })
    .where(eq(schema.integrationTable.id, integration.id));
  await deferIssueEdit(link, integration, ["description"]);
  expect((await metadata(link.id)).deferredIssueEdit.fields).toEqual([
    "description",
  ]);
  await replayDeferredIssueEdits();
  expect((await current(task.id))?.description).toBe("recovered body");
  expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
});

it("does not overwrite a local edit committed before its integration subscriber stamps it", async () => {
  const { task, integration, link } = await seed();
  await deferIssueEdit(link, integration, ["description"]);
  m.read.mockImplementationOnce(async () => {
    await db
      .update(schema.taskTable)
      .set({ description: "new local edit" })
      .where(eq(schema.taskTable.id, task.id));
    return { title: "A", body: "stale provider body", state: "closed" };
  });
  await replayDeferredIssueEdits();
  expect((await current(task.id))?.description).toBe("new local edit");
  expect((await metadata(link.id)).deferredIssueEdit).toBeDefined();
  expect(publishEvent).not.toHaveBeenCalled();
});
it.each(
  ["github", "gitea"].flatMap((provider) =>
    ["title", "description", "state"].map((field) => ({ provider, field })),
  ),
)(
  "repairs an expired older $provider $field writer without importing its stale value",
  async ({ provider, field }) => {
    const { task, integration, link } = await seed(provider);
    const local =
      field === "title" ? "B" : field === "description" ? "old body" : "open";
    const stale =
      field === "title"
        ? "A"
        : field === "description"
          ? "recovered body"
          : "closed";
    const stamp = outboundStamp(
      outboundStamp(undefined, stale, undefined, {
        intentId: "orphan",
        pending: true,
      }),
      local,
      "2026-09-30T00:00:02Z",
      { intentId: "newer-completed", pending: false },
    );
    const orphan = stamp.outbound?.find((entry) => entry.intentId === "orphan");
    if (!orphan) throw new Error("Missing orphan fixture");
    orphan.timestamp = new Date(Date.now() - 300_001).toISOString();
    await db
      .update(schema.externalLinkTable)
      .set({ metadata: JSON.stringify({ lastSync: { [field]: stamp } }) })
      .where(eq(schema.externalLinkTable.id, link.id));
    await deferIssueEdit(link, integration, [
      field as "title" | "description" | "state",
    ]);
    expect(
      (await metadata(link.id)).lastSync[field].outbound.find(
        (entry: { intentId: string }) => entry.intentId === "orphan",
      ),
    ).toMatchObject({ pending: false, uncertain: true });
    await replayDeferredIssueEdits();
    expect(await current(task.id)).toMatchObject({
      title: "B",
      description: "old body",
      status: "to-do",
    });
    expect(m.write).toHaveBeenCalledWith(
      expect.objectContaining(
        field === "description"
          ? { body: expect.stringContaining("old body") }
          : { [field]: local },
      ),
    );
    expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
    expect(publishEvent).not.toHaveBeenCalled();
  },
);

it("repairs an orphaned write using a newer local value whose subscriber has not stamped it", async () => {
  const { task, integration, link } = await seed();
  const stamp = outboundStamp(
    outboundStamp(undefined, "A", undefined, {
      intentId: "orphan",
      pending: true,
    }),
    "B",
    "2026-09-30T00:00:02Z",
    { intentId: "completed" },
  );
  const orphan = stamp.outbound?.find((entry) => entry.intentId === "orphan");
  if (!orphan) throw new Error("Missing orphan fixture");
  orphan.timestamp = new Date(Date.now() - 300_001).toISOString();
  await db
    .update(schema.externalLinkTable)
    .set({ metadata: JSON.stringify({ lastSync: { title: stamp } }) })
    .where(eq(schema.externalLinkTable.id, link.id));
  await db
    .update(schema.taskTable)
    .set({ title: "C" })
    .where(eq(schema.taskTable.id, task.id));
  await deferIssueEdit(link, integration, ["title"]);
  await replayDeferredIssueEdits();
  expect((await current(task.id))?.title).toBe("C");
  expect(m.write).toHaveBeenCalledWith(expect.objectContaining({ title: "C" }));
  expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
});

it.each(["github", "gitea"])(
  "preserves the final %s value when colliding-version webhooks arrive in reverse",
  async (provider) => {
    const { task, integration, link } = await seed(provider);
    await db
      .update(schema.taskTable)
      .set({ title: "A" })
      .where(eq(schema.taskTable.id, task.id));
    await db
      .update(schema.externalLinkTable)
      .set({
        metadata: JSON.stringify({
          lastSync: {
            title: outboundStamp(undefined, "A", "2026-09-30T00:00:03Z"),
          },
        }),
      })
      .where(eq(schema.externalLinkTable.id, link.id));
    const apply = async (title: string, from: string) => {
      const payload = {
        action: "edited",
        issue: {
          number: 1,
          title,
          body: "body",
          updated_at: "2026-09-30T00:00:03Z",
          html_url: link.url,
        },
        changes: { title: { from } },
        repository: {
          id: 20,
          name: "repo",
          full_name: "owner/repo",
          owner: { login: "owner" },
          html_url: "https://git.example/owner/repo",
        },
      };
      if (provider === "github") await handleIssueEdited(payload);
      else await handleGiteaIssueEdited(payload, integration.id);
    };
    await apply("A", "B");
    await apply("B", "A");
    expect((await current(task.id))?.title).toBe("A");
    expect(m.read).toHaveBeenCalledOnce();
    m.read.mockResolvedValueOnce({
      title: "B",
      body: "body",
      state: "open",
      updated_at: "2026-09-30T00:00:03Z",
    });
    await apply("B", "A");
    expect((await current(task.id))?.title).toBe("B");
  },
);

it.each([false, true])(
  "repairs a crashed first write after a later local edit (previousInbound=%s)",
  async (previousInbound) => {
    const { task, integration, link } = await seed();
    const prior = previousInbound
      ? inboundStamp(undefined, "B", "github")
      : undefined;
    const stamp = outboundStamp(prior, "A", undefined, {
      intentId: "first-orphan",
      pending: true,
    });
    const orphan = stamp.outbound?.find(
      (entry) => entry.intentId === "first-orphan",
    );
    if (!orphan) throw new Error("Missing orphan fixture");
    orphan.timestamp = new Date(Date.now() - 300_001).toISOString();
    await db
      .update(schema.externalLinkTable)
      .set({ metadata: JSON.stringify({ lastSync: { title: stamp } }) })
      .where(eq(schema.externalLinkTable.id, link.id));
    await db
      .update(schema.taskTable)
      .set({ title: "B" })
      .where(eq(schema.taskTable.id, task.id));
    await deferIssueEdit(link, integration, ["title"]);
    await replayDeferredIssueEdits();
    expect((await current(task.id))?.title).toBe("B");
    expect(m.write).toHaveBeenCalledWith(
      expect.objectContaining({ title: "B" }),
    );
    expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
  },
);

it("protects a local ABA edit even when its final fields and timestamp are unchanged", async () => {
  const { task, integration, link } = await seed();
  const updatedAt = new Date("2026-09-30T00:00:00Z");
  await db
    .update(schema.taskTable)
    .set({ updatedAt })
    .where(eq(schema.taskTable.id, task.id));
  await deferIssueEdit(link, integration, ["description"]);
  m.read.mockImplementationOnce(async () => {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.taskTable)
        .set({ description: "temporary edit", updatedAt })
        .where(eq(schema.taskTable.id, task.id));
      await tx
        .update(schema.taskTable)
        .set({ description: "old body", updatedAt })
        .where(eq(schema.taskTable.id, task.id));
    });
    return { title: "A", body: "stale provider body", state: "closed" };
  });
  await replayDeferredIssueEdits();
  expect((await current(task.id))?.description).toBe("old body");
  expect((await metadata(link.id)).deferredIssueEdit).toBeDefined();
});

it.each(["github", "gitea"])(
  "retires a deleted %s issue's deferred read without removing its link or task",
  async (provider) => {
    const { task, integration, link } = await seed(provider);
    await deferIssueEdit(link, integration, ["description"]);
    m.read.mockRejectedValue(
      Object.assign(new Error("not found"), { status: 404 }),
    );
    expect(await replayDeferredIssueEdits()).toEqual({ degraded: false });
    expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
    expect(await current(task.id)).toMatchObject({
      title: "B",
      description: "old body",
    });
    expect(
      await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.id, link.id),
      }),
    ).toBeDefined();
    expect(publishEvent).not.toHaveBeenCalled();
    expect(m.write).not.toHaveBeenCalled();
    await replayDeferredIssueEdits();
    expect(m.read).toHaveBeenCalledOnce();
  },
);
it.each([403, 429, 500, 408])(
  "retains a deferred issue read after HTTP %s",
  async (status) => {
    const { integration, link } = await seed();
    await deferIssueEdit(link, integration, ["description"]);
    m.read.mockRejectedValue(
      Object.assign(new Error("provider unavailable"), { status }),
    );
    expect(await replayDeferredIssueEdits()).toEqual({ degraded: true });
    expect((await metadata(link.id)).deferredIssueEdit.fields).toEqual([
      "description",
    ]);
  },
);
it("preserves a newer job queued while a missing-issue read is in flight", async () => {
  const { task, integration, link } = await seed();
  await deferIssueEdit(link, integration, ["state"]);
  m.read.mockImplementationOnce(async () => {
    await deferIssueEdit(link, integration, ["description"]);
    throw Object.assign(new Error("not found"), { status: 404 });
  });
  await replayDeferredIssueEdits();
  expect((await metadata(link.id)).deferredIssueEdit.fields).toEqual([
    "state",
    "description",
  ]);
  await replayDeferredIssueEdits();
  expect(await current(task.id)).toMatchObject({
    status: "done",
    description: "recovered body",
  });
  expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
});
it("retains missing-issue work when credentials rotate during the read", async () => {
  const { task, integration, link } = await seed("gitea");
  await deferIssueEdit(link, integration, ["description"]);
  m.read.mockImplementationOnce(async () => {
    await db
      .update(schema.integrationTable)
      .set({
        config: JSON.stringify({
          ...JSON.parse(integration.config),
          accessToken: "rotated-test-secret",
        }),
      })
      .where(eq(schema.integrationTable.id, integration.id));
    throw Object.assign(new Error("not found"), { status: 404 });
  });
  await replayDeferredIssueEdits();
  expect((await metadata(link.id)).deferredIssueEdit).toBeDefined();
  await replayDeferredIssueEdits();
  expect((await current(task.id))?.description).toBe("recovered body");
  expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
});

type IssueField = "title" | "description" | "state";
async function deliverField(
  provider: string,
  field: IssueField,
  value: string,
  version: string,
  integrationId: string,
) {
  const payload = {
    action:
      field === "state"
        ? value === "closed"
          ? "closed"
          : "reopened"
        : "edited",
    issue: {
      number: 1,
      title: field === "title" ? value : "unchanged",
      body: field === "description" ? value : "unchanged",
      state: field === "state" ? value : "open",
      updated_at: version,
      html_url: "https://git.example/owner/repo/issues/1",
    },
    changes:
      field === "title"
        ? { title: { from: "before" } }
        : { body: { from: "before" } },
    repository: {
      id: 20,
      name: "repo",
      full_name: "owner/repo",
      owner: { login: "owner" },
      html_url: "https://git.example/owner/repo",
    },
  };
  if (field !== "state") {
    if (provider === "github") await handleIssueEdited(payload);
    else await handleGiteaIssueEdited(payload, integrationId);
  } else if (provider === "github") {
    await (value === "closed" ? handleIssueClosed : handleIssueReopened)(
      payload,
    );
  } else {
    await (
      value === "closed" ? handleGiteaIssueClosed : handleGiteaIssueReopened
    )(payload, integrationId);
  }
}
const providerFields = ["github", "gitea"].flatMap((provider) =>
  (["title", "description", "state"] as const).map((field) => ({
    provider,
    field,
  })),
);
it.each(
  providerFields.flatMap((entry) =>
    [false, true].map((collision) => ({ ...entry, collision })),
  ),
)(
  "preserves the latest genuine $provider $field delivery (sameVersion=$collision)",
  async ({ provider, field, collision }) => {
    const { task, integration, link } = await seed(provider);
    await db
      .update(schema.externalLinkTable)
      .set({ metadata: "{}" })
      .where(eq(schema.externalLinkTable.id, link.id));
    const latest = field === "state" ? "open" : "remote-new";
    const older = field === "state" ? "closed" : "remote-old";
    const version = "2026-09-30T00:00:03Z";
    m.read.mockResolvedValue({
      title: latest,
      body: latest,
      state: "open",
      updated_at: version,
    });
    await deliverField(provider, field, latest, version, integration.id);
    await deliverField(
      provider,
      field,
      older,
      collision ? version : "2026-09-30T00:00:02Z",
      integration.id,
    );
    const row = await current(task.id);
    expect(field === "state" ? row?.status : row?.[field]).toBe(
      field === "state" ? "to-do" : latest,
    );
    expect((await metadata(link.id)).lastSync[field].inboundUpdatedAt).toBe(
      version,
    );
    if (collision) expect(m.read).toHaveBeenCalledOnce();
    else expect(m.read).not.toHaveBeenCalled();
    await deliverField(
      provider,
      field,
      older,
      "2026-09-30T00:00:04Z",
      integration.id,
    );
    const after = await current(task.id);
    expect(field === "state" ? after?.status : after?.[field]).toBe(
      field === "state" ? "done" : older,
    );
  },
);
it.each(
  providerFields.flatMap((entry) =>
    [1, 2].map((count) => ({ ...entry, count })),
  ),
)(
  "repairs a late timed-out $provider $field write without reverting the newer local value (uncertain=$count)",
  async ({ provider, field, count }) => {
    const { task, integration, link } = await seed(provider);
    const older = field === "state" ? "closed" : "remote-old";
    const latest =
      field === "state" ? "open" : field === "title" ? "B" : "old body";
    const pending = outboundStamp(undefined, older, undefined, {
      intentId: "timed-out",
      pending: true,
    });
    let uncertain = outboundStamp(pending, older, undefined, {
      intentId: "timed-out",
      pending: false,
      uncertain: true,
    });
    if (count === 2)
      uncertain = outboundStamp(uncertain, older, undefined, {
        intentId: "second-timed-out",
        pending: false,
        uncertain: true,
      });
    const stamp = outboundStamp(uncertain, latest, "2026-09-30T00:00:02Z", {
      intentId: "newer-completed",
    });
    await db
      .update(schema.externalLinkTable)
      .set({ metadata: JSON.stringify({ lastSync: { [field]: stamp } }) })
      .where(eq(schema.externalLinkTable.id, link.id));
    m.read.mockResolvedValue({
      title: older,
      body: older,
      state: "closed",
      updated_at: "2026-09-30T00:00:03Z",
    });
    await deliverField(
      provider,
      field,
      older,
      "2026-09-30T00:00:03Z",
      integration.id,
    );
    expect((await metadata(link.id)).deferredIssueEdit.fields).toEqual([field]);
    expect(await current(task.id)).toMatchObject({
      title: "B",
      description: "old body",
      status: "to-do",
    });
    await replayDeferredIssueEdits();
    expect(await current(task.id)).toMatchObject({
      title: "B",
      description: "old body",
      status: "to-do",
    });
    expect(m.write).toHaveBeenCalledWith(
      expect.objectContaining(
        field === "description"
          ? { body: expect.stringContaining(latest) }
          : { [field]: latest },
      ),
    );
    expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
    expect(publishEvent).not.toHaveBeenCalled();
    await deliverField(
      provider,
      field,
      older,
      "2026-09-30T00:00:05Z",
      integration.id,
    );
    const later = await current(task.id);
    expect(field === "state" ? later?.status : later?.[field]).toBe(
      field === "state" ? "done" : older,
    );
    expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
  },
);

it("completes uncertain replay when the task already equals the provider", async () => {
  const { task, integration, link } = await seed();
  const uncertain = outboundStamp(
    outboundStamp(undefined, "A", undefined, {
      intentId: "uncertain",
      pending: true,
    }),
    "A",
    undefined,
    { intentId: "uncertain", pending: false, uncertain: true },
  );
  const stamp = outboundStamp(uncertain, "B", "2026-09-30T00:00:02Z");
  await db
    .update(schema.externalLinkTable)
    .set({ metadata: JSON.stringify({ lastSync: { title: stamp } }) })
    .where(eq(schema.externalLinkTable.id, link.id));
  await db
    .update(schema.taskTable)
    .set({ title: "A" })
    .where(eq(schema.taskTable.id, task.id));
  await deferIssueEdit(link, integration, ["title"]);
  expect(await replayDeferredIssueEdits()).toEqual({ degraded: false });
  expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
  expect((await current(task.id))?.title).toBe("A");
  expect(m.write).not.toHaveBeenCalled();
});
it("repairs an uncertain delivery over an unstamped local edit after a genuine provider edit", async () => {
  const { task, integration, link } = await seed();
  const pending = outboundStamp(undefined, "A", undefined, {
    intentId: "uncertain",
    pending: true,
  });
  const stamp = inboundStamp(
    outboundStamp(pending, "A", undefined, {
      intentId: "uncertain",
      pending: false,
      uncertain: true,
    }),
    "B",
    "github",
    "2026-09-30T00:00:02Z",
  );
  await db
    .update(schema.externalLinkTable)
    .set({ metadata: JSON.stringify({ lastSync: { title: stamp } }) })
    .where(eq(schema.externalLinkTable.id, link.id));
  await db
    .update(schema.taskTable)
    .set({ title: "C" })
    .where(eq(schema.taskTable.id, task.id));
  await deliverField(
    "github",
    "title",
    "A",
    "2026-09-30T00:00:03Z",
    integration.id,
  );
  expect((await current(task.id))?.title).toBe("C");
  expect((await metadata(link.id)).deferredIssueEdit.fields).toEqual(["title"]);
  await replayDeferredIssueEdits();
  expect(m.write).toHaveBeenCalledWith(expect.objectContaining({ title: "C" }));
});

it("retains the uncertain intent and job when corrective provider HTTP fails", async () => {
  const { task, integration, link } = await seed();
  const pending = outboundStamp(undefined, "A", undefined, {
    intentId: "failed-repair",
    pending: true,
  });
  const stamp = outboundStamp(
    outboundStamp(pending, "A", undefined, {
      intentId: "failed-repair",
      pending: false,
      uncertain: true,
    }),
    "B",
    "2026-09-30T00:00:02Z",
  );
  await db
    .update(schema.externalLinkTable)
    .set({ metadata: JSON.stringify({ lastSync: { title: stamp } }) })
    .where(eq(schema.externalLinkTable.id, link.id));
  await deferIssueEdit(link, integration, ["title"]);
  m.write.mockRejectedValueOnce(new Error("provider unavailable"));
  expect(await replayDeferredIssueEdits()).toEqual({ degraded: true });
  const queued = await metadata(link.id);
  expect(queued.deferredIssueEdit).toBeDefined();
  const retained = queued.lastSync.title.outbound.find(
    (entry: { intentId: string }) => entry.intentId === "failed-repair",
  );
  expect(retained.uncertain).toBe(true);
  expect(retained.cancelled).not.toBe(true);
  await replayDeferredIssueEdits();
  expect((await current(task.id))?.title).toBe("B");
  expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
});

it.each(providerFields)(
  "rechecks a stale $provider $field confirmation after a newer colliding webhook",
  async ({ provider, field }) => {
    const { task, integration, link } = await seed(provider);
    const version = "2026-09-30T00:00:03Z";
    const initial = field === "state" ? "closed" : "A";
    const stale = field === "state" ? "open" : "B";
    const latest = field === "state" ? "closed" : "C";
    await db
      .update(schema.taskTable)
      .set({
        [field === "state" ? "status" : field]:
          field === "state" ? "done" : initial,
      })
      .where(eq(schema.taskTable.id, task.id));
    await db
      .update(schema.externalLinkTable)
      .set({
        metadata: JSON.stringify({
          lastSync: {
            [field]: inboundStamp(undefined, initial, provider, version),
          },
        }),
      })
      .where(eq(schema.externalLinkTable.id, link.id));
    m.read.mockResolvedValue({
      title: latest,
      body: latest,
      state: "closed",
      updated_at: version,
    });
    m.read.mockImplementationOnce(async () => {
      await deliverField(provider, field, latest, version, integration.id);
      return { title: stale, body: stale, state: "open", updated_at: version };
    });
    await deliverField(provider, field, stale, version, integration.id);
    const row = await current(task.id);
    expect(field === "state" ? row?.status : row?.[field]).toBe(
      field === "state" ? "done" : latest,
    );
    expect((await metadata(link.id)).lastSync[field].inboundValue).toBe(latest);
    expect(m.read.mock.calls.length).toBeGreaterThanOrEqual(2);
  },
);
it.each(["github", "gitea"])(
  "validates each changed %s field when a shared confirmation GET becomes stale",
  async (provider) => {
    const { task, integration, link } = await seed(provider);
    const version = "2026-09-30T00:00:03Z";
    await db
      .update(schema.taskTable)
      .set({ title: "A", description: "A" })
      .where(eq(schema.taskTable.id, task.id));
    await db
      .update(schema.externalLinkTable)
      .set({
        metadata: JSON.stringify({
          lastSync: {
            title: inboundStamp(undefined, "A", provider, version),
            description: inboundStamp(undefined, "A", provider, version),
          },
        }),
      })
      .where(eq(schema.externalLinkTable.id, link.id));
    m.read.mockResolvedValue({
      title: "B",
      body: "C",
      state: "open",
      updated_at: version,
    });
    m.read.mockImplementationOnce(async () => {
      await deliverField(provider, "description", "C", version, integration.id);
      return { title: "B", body: "B", state: "open", updated_at: version };
    });
    const payload = {
      action: "edited",
      issue: {
        number: 1,
        title: "B",
        body: "B",
        updated_at: version,
        html_url: link.url,
      },
      changes: { title: { from: "A" }, body: { from: "A" } },
      repository: {
        id: 20,
        name: "repo",
        full_name: "owner/repo",
        owner: { login: "owner" },
        html_url: "https://git.example/owner/repo",
      },
    };
    if (provider === "github") await handleIssueEdited(payload);
    else await handleGiteaIssueEdited(payload, integration.id);
    expect(await current(task.id)).toMatchObject({
      title: "B",
      description: "C",
    });
  },
);

it.each(["github", "gitea"])(
  "preserves a newer local edit committed during %s provider confirmation",
  async (provider) => {
    const { task, integration, link } = await seed(provider);
    const version = "2026-09-30T00:00:03Z";
    await db
      .update(schema.taskTable)
      .set({ title: "A" })
      .where(eq(schema.taskTable.id, task.id));
    await db
      .update(schema.externalLinkTable)
      .set({
        metadata: JSON.stringify({
          lastSync: { title: inboundStamp(undefined, "A", provider, version) },
        }),
      })
      .where(eq(schema.externalLinkTable.id, link.id));
    m.read.mockResolvedValue({
      title: "B",
      body: "body",
      state: "open",
      updated_at: version,
    });
    m.read.mockImplementationOnce(async () => {
      await db
        .update(schema.taskTable)
        .set({ title: "C" })
        .where(eq(schema.taskTable.id, task.id));
      return { title: "B", body: "body", state: "open", updated_at: version };
    });
    await deliverField(provider, "title", "B", version, integration.id);
    expect((await current(task.id))?.title).toBe("C");
    expect(publishEvent).not.toHaveBeenCalled();
  },
);

it.each(
  (["github", "gitea"] as const).flatMap((provider) =>
    (["title", "description", "state"] as const).map((field) => ({
      provider,
      field,
    })),
  ),
)(
  "bounds sustained $provider/$field correction and durably syncs the latest task",
  async ({ provider, field }) => {
    const { task, integration, link } = await seed(provider);
    await db
      .update(schema.externalLinkTable)
      .set({ metadata: "{}" })
      .where(eq(schema.externalLinkTable.id, link.id));
    const initial = field === "state" ? "open" : "A";
    const column = field === "state" ? "status" : field;
    const write = vi.fn(async () => {
      if (write.mock.calls.length > 6)
        throw new Error("unbounded repair regression");
      await db
        .update(schema.taskTable)
        .set({
          [column]:
            field === "state"
              ? write.mock.calls.length % 2
                ? "done"
                : "to-do"
              : `edit-${write.mock.calls.length}`,
        })
        .where(eq(schema.taskTable.id, task.id));
      return "2026-09-30T00:00:04Z";
    });
    await syncLatestTaskValue(
      task.id,
      integration.projectId,
      link,
      field,
      initial,
      write,
    ).catch(() => undefined);
    expect(write).toHaveBeenCalledTimes(3);
    expect((await metadata(link.id)).deferredIssueEdit).toMatchObject({
      fields: [],
      repairFields: [field],
    });
    expect(JSON.stringify(await metadata(link.id))).not.toContain(
      "test-secret-never-metadata",
    );
    const latest = field === "state" ? "closed" : "latest local";
    await db
      .update(schema.taskTable)
      .set({ [column]: field === "state" ? "done" : latest })
      .where(eq(schema.taskTable.id, task.id));
    await replayDeferredIssueEdits();
    expect(m.write).toHaveBeenCalledTimes(1);
    expect(m.write).toHaveBeenCalledWith(
      expect.objectContaining(
        field === "description"
          ? { body: expect.stringContaining(latest) }
          : { [field]: latest },
      ),
    );
    expect((await current(task.id))?.[column]).toBe(
      field === "state" ? "done" : latest,
    );
    expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
    expect(publishEvent).not.toHaveBeenCalled();
  },
);

it("coalesces local correction fields with inbound deliveries without importing stale values", async () => {
  const { task, integration, link } = await seed();
  await db
    .update(schema.externalLinkTable)
    .set({ metadata: "{}" })
    .where(eq(schema.externalLinkTable.id, link.id));
  await Promise.all([
    deferTaskSync(link, integration, ["title"]),
    deferTaskSync(link, integration, ["description"]),
    deferIssueEdit(link, integration, ["state"]),
  ]);
  const job = (await metadata(link.id)).deferredIssueEdit;
  expect(job.fields).toEqual(["state"]);
  expect(job.repairFields.sort()).toEqual(["description", "title"]);
  await replayDeferredIssueEdits();
  expect(await current(task.id)).toMatchObject({
    title: "B",
    description: "old body",
    status: "done",
  });
  expect(m.write).toHaveBeenCalledTimes(2);
  expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
});
it("retains failed queued corrections and retries the current task value", async () => {
  const { task, integration, link } = await seed();
  await db
    .update(schema.externalLinkTable)
    .set({ metadata: "{}" })
    .where(eq(schema.externalLinkTable.id, link.id));
  await deferTaskSync(link, integration, ["title"]);
  m.write.mockRejectedValueOnce(new Error("provider unavailable"));
  expect(await replayDeferredIssueEdits()).toEqual({ degraded: true });
  expect((await metadata(link.id)).deferredIssueEdit.repairFields).toEqual([
    "title",
  ]);
  await db
    .update(schema.taskTable)
    .set({ title: "latest" })
    .where(eq(schema.taskTable.id, task.id));
  await replayDeferredIssueEdits();
  expect(m.write).toHaveBeenLastCalledWith(
    expect.objectContaining({ title: "latest" }),
  );
  expect((await current(task.id))?.title).toBe("latest");
  expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
  expect(publishEvent).not.toHaveBeenCalled();
});
it("preserves a newer correction queued while its worker reads the provider", async () => {
  const { integration, link } = await seed();
  await db
    .update(schema.externalLinkTable)
    .set({ metadata: "{}" })
    .where(eq(schema.externalLinkTable.id, link.id));
  await deferTaskSync(link, integration, ["title"]);
  const first = (await metadata(link.id)).deferredIssueEdit.id;
  m.read.mockImplementationOnce(async () => {
    await deferTaskSync(link, integration, ["description"]);
    return { title: "A", body: "remote", state: "open" };
  });
  await replayDeferredIssueEdits();
  expect(m.write).not.toHaveBeenCalled();
  const next = (await metadata(link.id)).deferredIssueEdit;
  expect(next.id).not.toBe(first);
  expect(next.repairFields.sort()).toEqual(["description", "title"]);
  await replayDeferredIssueEdits();
  expect(m.write).toHaveBeenCalledTimes(2);
  expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
});

it.each(
  ["github", "gitea"].flatMap((provider) =>
    [1, 2].map((count) => ({ provider, count })),
  ),
)(
  "retires uncertain intents after queued $provider correction so future genuine edits apply (uncertain=$count)",
  async ({ provider, count }) => {
    const { task, integration, link } = await seed(provider);
    let stamp = outboundStamp(undefined, "A", undefined, {
      intentId: "old-unknown",
      pending: false,
      uncertain: true,
    });
    if (count === 2)
      stamp = outboundStamp(stamp, "A", undefined, {
        intentId: "second-unknown",
        pending: false,
        uncertain: true,
      });
    await db
      .update(schema.externalLinkTable)
      .set({
        metadata: JSON.stringify({
          lastSync: {
            title: stamp,
          },
        }),
      })
      .where(eq(schema.externalLinkTable.id, link.id));
    await deferTaskSync(link, integration, ["title"]);
    await replayDeferredIssueEdits();
    expect(m.write).toHaveBeenCalledWith(
      expect.objectContaining({ title: "B" }),
    );
    expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
    m.read.mockResolvedValue({
      title: "A",
      body: "remote",
      state: "open",
      updated_at: "2026-09-30T00:00:05Z",
    });
    await deliverField(
      provider,
      "title",
      "A",
      "2026-09-30T00:00:05Z",
      integration.id,
    );
    expect((await current(task.id))?.title).toBe("A");
  },
);

it.each(
  ["github", "gitea"].flatMap((provider) =>
    ["webhook", "worker"].map((mode) => ({ provider, mode })),
  ),
)(
  "protects a local edit when only the older of two uncertain $provider writes precedes it ($mode)",
  async ({ provider, mode }) => {
    const { task, integration, link } = await seed(provider);
    let stamp = outboundStamp(undefined, "A", undefined, {
      intentId: "before-local",
      pending: true,
    });
    stamp = inboundStamp(stamp, "B", provider);
    stamp = outboundStamp(stamp, "A", undefined, {
      intentId: "after-local",
      pending: true,
    });
    stamp = outboundStamp(stamp, "A", undefined, {
      intentId: "before-local",
      pending: false,
      uncertain: true,
    });
    stamp = outboundStamp(stamp, "A", undefined, {
      intentId: "after-local",
      pending: false,
      uncertain: true,
    });
    await db
      .update(schema.externalLinkTable)
      .set({ metadata: JSON.stringify({ lastSync: { title: stamp } }) })
      .where(eq(schema.externalLinkTable.id, link.id));
    if (mode === "webhook")
      await deliverField(
        provider,
        "title",
        "A",
        "2026-09-30T00:00:03Z",
        integration.id,
      );
    else await deferIssueEdit(link, integration, ["title"]);
    await replayDeferredIssueEdits();
    expect((await current(task.id))?.title).toBe("B");
    expect(m.write).toHaveBeenCalledWith(
      expect.objectContaining({ title: "B" }),
    );
  },
);

it.each(["uncertain", "pending"])(
  "settles a matching %s write during repair while preserving active requests",
  async (kind) => {
    const { integration, link } = await seed();
    await db
      .update(schema.externalLinkTable)
      .set({
        metadata: JSON.stringify({
          lastSync: {
            title: outboundStamp(undefined, "A", undefined, {
              intentId: "old",
              uncertain: true,
            }),
          },
        }),
      })
      .where(eq(schema.externalLinkTable.id, link.id));
    await deferTaskSync(link, integration, ["title"]);
    m.write.mockImplementationOnce(async () => {
      await updateExternalLink(link.id, {
        outbound: {
          field: "title",
          value: "A",
          intentId: "new",
          pending: kind === "pending",
          uncertain: kind === "uncertain",
        },
      });
      return { updated_at: "2026-09-30T00:00:04Z" };
    });
    await replayDeferredIssueEdits();
    const entries = (await metadata(link.id)).lastSync.title.outbound;
    expect(
      entries.find((entry: { intentId: string }) => entry.intentId === "old"),
    ).toMatchObject({ cancelled: true, uncertain: false, pending: false });
    expect(
      entries.find((entry: { intentId: string }) => entry.intentId === "new"),
    ).toMatchObject({
      pending: kind === "pending",
      uncertain: false,
    });
    expect(
      entries.find((entry: { intentId: string }) => entry.intentId === "new")
        .cancelled,
    ).toBe(kind === "uncertain" ? true : undefined);
  },
);
it("retains every captured uncertain intent when the corrective provider write fails", async () => {
  const { integration, link } = await seed();
  let stamp = outboundStamp(undefined, "A", undefined, {
    intentId: "first",
    uncertain: true,
  });
  stamp = outboundStamp(stamp, "A", undefined, {
    intentId: "second",
    uncertain: true,
  });
  await db
    .update(schema.externalLinkTable)
    .set({ metadata: JSON.stringify({ lastSync: { title: stamp } }) })
    .where(eq(schema.externalLinkTable.id, link.id));
  await deferTaskSync(link, integration, ["title"]);
  m.write.mockRejectedValueOnce(new Error("provider unavailable"));
  expect(await replayDeferredIssueEdits()).toEqual({ degraded: true });
  const saved = await metadata(link.id);
  expect(saved.deferredIssueEdit).toBeDefined();
  for (const id of ["first", "second"]) {
    const intent = saved.lastSync.title.outbound.find(
      (entry: { intentId: string }) => entry.intentId === id,
    );
    expect(intent.uncertain).toBe(true);
    expect(intent.cancelled).not.toBe(true);
  }
});

it.each(
  providerFields.flatMap((entry) =>
    ["rebound", "disabled", "credentials"].map((change) => ({
      ...entry,
      change,
    })),
  ),
)(
  "guards the $provider $field confirmation after its integration is $change",
  async ({ provider, field, change }) => {
    const { task, integration, link } = await seed(provider);
    const version = "2026-09-30T00:00:03Z";
    const before = field === "state" ? "closed" : "A";
    const after = field === "state" ? "open" : "B";
    const column = field === "state" ? "status" : field;
    await db
      .update(schema.taskTable)
      .set({ [column]: field === "state" ? "done" : before })
      .where(eq(schema.taskTable.id, task.id));
    await db
      .update(schema.externalLinkTable)
      .set({
        metadata: JSON.stringify({
          lastSync: {
            [field]: inboundStamp(undefined, before, provider, version),
          },
        }),
      })
      .where(eq(schema.externalLinkTable.id, link.id));
    m.read.mockImplementationOnce(async () => {
      const config = JSON.parse(integration.config);
      await db
        .update(schema.integrationTable)
        .set(
          change === "disabled"
            ? { isActive: false }
            : {
                config: JSON.stringify({
                  ...config,
                  ...(change === "rebound"
                    ? { repositoryName: "other" }
                    : { accessToken: "new-fake-token" }),
                }),
              },
        )
        .where(eq(schema.integrationTable.id, integration.id));
      return {
        title: field === "title" ? after : "A",
        body: field === "description" ? after : "A",
        state: field === "state" ? after : "closed",
        updated_at: version,
      };
    });
    await deliverField(provider, field, after, version, integration.id);
    const value = change === "credentials" ? after : before;
    expect((await current(task.id))?.[column]).toBe(
      field === "state" ? (value === "closed" ? "done" : "to-do") : value,
    );
    expect(m.read).toHaveBeenCalledOnce();
    if (change !== "credentials") expect(publishEvent).not.toHaveBeenCalled();
  },
);

it.each(
  providerFields.flatMap((entry) =>
    ["inbound", "queued"].map((mode) => ({ ...entry, mode })),
  ),
)(
  "retires successful $provider/$field repairs before a later field fails ($mode)",
  async ({ provider, field, mode }) => {
    const { task, integration, link } = await seed(provider);
    const next = field === "title" ? "description" : "title";
    const before = field === "state" ? "closed" : "A";
    const stamps: Record<string, unknown> = {};
    for (const f of [field, next]) {
      const value = f === "state" ? "closed" : "A";
      stamps[f] = outboundStamp(
        outboundStamp(undefined, value, undefined, {
          intentId: `${f}-old-1`,
          uncertain: true,
        }),
        value,
        undefined,
        { intentId: `${f}-old-2`, uncertain: true },
      );
    }
    await db
      .update(schema.externalLinkTable)
      .set({ metadata: JSON.stringify({ lastSync: stamps }) })
      .where(eq(schema.externalLinkTable.id, link.id));
    if (mode === "queued")
      await deferTaskSync(link, integration, [field, next]);
    else await deferIssueEdit(link, integration, [field, next]);
    const issue: {
      title: string;
      body: string;
      state: string;
      updated_at: string;
    } = {
      title: "A",
      body: "A",
      state: "closed",
      updated_at: "2026-09-30T00:00:03Z",
    };
    m.read.mockImplementation(async () => ({ ...issue }));
    m.write.mockImplementation(async (payload: Record<string, string>) => {
      if (m.write.mock.calls.length === 2)
        throw new Error("second field failed");
      if (payload.title !== undefined) issue.title = payload.title;
      if (payload.body !== undefined) issue.body = payload.body;
      if (payload.state !== undefined) issue.state = payload.state;
      issue.updated_at = "2026-09-30T00:00:05Z";
      return { updated_at: issue.updated_at };
    });
    expect(await replayDeferredIssueEdits()).toEqual({ degraded: true });
    const saved = await metadata(link.id);
    expect(saved.deferredIssueEdit).toBeDefined();
    for (const id of [`${field}-old-1`, `${field}-old-2`])
      expect(
        saved.lastSync[field].outbound.find(
          (entry: { intentId: string }) => entry.intentId === id,
        ),
      ).toMatchObject({ cancelled: true, uncertain: false });
    for (const id of [`${next}-old-1`, `${next}-old-2`])
      expect(
        saved.lastSync[next].outbound.find(
          (entry: { intentId: string }) => entry.intentId === id,
        ).cancelled,
      ).not.toBe(true);
    await replayDeferredIssueEdits();
    expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
    if (field === "description") issue.body = before;
    else issue[field] = before;
    issue.updated_at = "2026-09-30T00:00:06Z";
    await deliverField(
      provider,
      field,
      before,
      issue.updated_at,
      integration.id,
    );
    expect(
      field === "state"
        ? (await current(task.id))?.status
        : (await current(task.id))?.[field],
    ).toBe(field === "state" ? "done" : before);
  },
);

it.each(providerFields)(
  "settles a $provider/$field write that becomes uncertain during correction before later genuine edits",
  async ({ provider, field }) => {
    const { task, integration, link } = await seed(provider);
    const older = field === "state" ? "closed" : "A";
    await db
      .update(schema.externalLinkTable)
      .set({
        metadata: JSON.stringify({
          lastSync: {
            [field]: outboundStamp(undefined, older, undefined, {
              intentId: "old",
              uncertain: true,
            }),
          },
        }),
      })
      .where(eq(schema.externalLinkTable.id, link.id));
    await deferTaskSync(link, integration, [field]);
    m.write.mockImplementationOnce(async () => {
      await updateExternalLink(link.id, {
        outbound: {
          field,
          value: older,
          intentId: "during-repair",
          pending: false,
          uncertain: true,
        },
      });
      return { updated_at: "2026-09-30T00:00:04Z" };
    });
    await replayDeferredIssueEdits();
    const column = field === "state" ? "status" : field;
    const later = field === "state" ? "open" : "C";
    await db
      .update(schema.taskTable)
      .set({ [column]: field === "state" ? "in-progress" : later })
      .where(eq(schema.taskTable.id, task.id));
    await syncLatestTaskValue(
      task.id,
      integration.projectId,
      link,
      field,
      later,
      async () => "2026-09-30T00:00:05Z",
    );
    m.read.mockResolvedValue({
      title: older,
      body: older,
      state: "closed",
      updated_at: "2026-09-30T00:00:06Z",
    });
    await deliverField(
      provider,
      field,
      older,
      "2026-09-30T00:00:06Z",
      integration.id,
    );
    expect((await current(task.id))?.[column]).toBe(
      field === "state" ? "done" : older,
    );
  },
);
it("queues an intent inserted after the repair receipt for a fresh correction", async () => {
  const { task, integration, link } = await seed();
  await db
    .update(schema.externalLinkTable)
    .set({
      metadata: JSON.stringify({
        lastSync: {
          title: outboundStamp(undefined, "A", undefined, {
            intentId: "old",
            uncertain: true,
          }),
        },
      }),
    })
    .where(eq(schema.externalLinkTable.id, link.id));
  await deferTaskSync(link, integration, ["title"]);
  const find = db.query.externalLinkTable.findMany.bind(
    db.query.externalLinkTable,
  );
  let inserted = false;
  const spy = vi
    .spyOn(db.query.externalLinkTable, "findMany")
    .mockImplementation(async (options) => {
      const rows = await find(options);
      if (
        !inserted &&
        m.write.mock.calls.length &&
        rows.some(
          (row) =>
            JSON.parse(row.metadata ?? "{}").lastSync?.title?.value === "B",
        )
      ) {
        inserted = true;
        await updateExternalLink(link.id, {
          outbound: {
            field: "title",
            value: "A",
            intentId: "after-receipt",
            pending: false,
            uncertain: true,
          },
        });
        return find(options);
      }
      return rows;
    });
  try {
    await replayDeferredIssueEdits();
  } finally {
    spy.mockRestore();
  }
  expect(inserted).toBe(true);
  expect((await metadata(link.id)).deferredIssueEdit.repairFields).toEqual([
    "title",
  ]);
  await db
    .update(schema.taskTable)
    .set({ title: "C" })
    .where(eq(schema.taskTable.id, task.id));
  await syncLatestTaskValue(
    task.id,
    integration.projectId,
    link,
    "title",
    "C",
    async () => "2026-09-30T00:00:05Z",
  );
  m.read.mockResolvedValue({
    title: "A",
    body: "body",
    state: "open",
    updated_at: "2026-09-30T00:00:06Z",
  });
  await deliverField(
    "github",
    "title",
    "A",
    "2026-09-30T00:00:06Z",
    integration.id,
  );
  expect((await current(task.id))?.title).toBe("A");
});
it("durably queues an uncertain standalone writer and later settles it", async () => {
  const { task, integration, link } = await seed();
  await db
    .update(schema.externalLinkTable)
    .set({ metadata: "{}" })
    .where(eq(schema.externalLinkTable.id, link.id));
  await expect(
    syncLatestTaskValue(
      task.id,
      integration.projectId,
      link,
      "title",
      "A",
      async () => {
        throw new Error("provider unavailable");
      },
    ),
  ).rejects.toThrow("provider unavailable");
  expect((await metadata(link.id)).deferredIssueEdit.repairFields).toEqual([
    "title",
  ]);
  await replayDeferredIssueEdits();
  expect((await metadata(link.id)).deferredIssueEdit).toBeUndefined();
  m.read.mockResolvedValue({
    title: "A",
    body: "body",
    state: "open",
    updated_at: "2026-09-30T00:00:06Z",
  });
  await deliverField(
    "github",
    "title",
    "A",
    "2026-09-30T00:00:06Z",
    integration.id,
  );
  expect((await current(task.id))?.title).toBe("A");
});

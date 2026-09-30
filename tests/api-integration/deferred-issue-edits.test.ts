import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { publishEvent } from "../../apps/api/src/events";
import {
  deferIssueEdit,
  replayDeferredIssueEdits,
} from "../../apps/api/src/plugins/github/services/deferred-issue-edits";
import { updateExternalLink } from "../../apps/api/src/plugins/github/services/link-manager";
import { handleGiteaIssueEdited } from "../../apps/api/src/plugins/gitea/webhooks/issue-edited";
import { handleIssueEdited } from "../../apps/api/src/plugins/github/webhooks/issue-edited";
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

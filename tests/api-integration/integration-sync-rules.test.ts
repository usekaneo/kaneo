import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import * as events from "../../apps/api/src/events";
import * as assets from "../../apps/api/src/storage/cleanup-assets";
import { handleGitlabIssueReopened } from "../../apps/api/src/plugins/gitlab/webhooks/issue-reopened";
import db, { getDatabase, schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { getSyncIntegration } from "../../apps/api/src/integration-sync/controllers/get-integration";
import { previewSyncRules } from "../../apps/api/src/integration-sync/controllers/preview-rules";
import { resumeSync } from "../../apps/api/src/integration-sync/controllers/resume-sync";
import { reviewSyncResume } from "../../apps/api/src/integration-sync/controllers/review-resume";
import { lockResumeScope } from "../../apps/api/src/integration-sync/controllers/lock-resume-scope";
import { saveSyncRules } from "../../apps/api/src/integration-sync/controllers/save-rules";
import moveProject from "../../apps/api/src/project/controllers/move-project";
import * as linkManager from "../../apps/api/src/plugins/github/services/link-manager";
import { createExternalLink } from "../../apps/api/src/plugins/github/services/link-manager";
import { withIntegrationLink } from "../../apps/api/src/plugins/github/services/with-integration-link";
import { withTaskSyncCreation } from "../../apps/api/src/plugins/sync/create-task-issue";
import { outgoingPredicate } from "../../apps/api/src/plugins/sync/task-predicate";
import {
  canSyncTask,
  taskMatchesRule,
} from "../../apps/api/src/plugins/sync/eligibility";
import {
  acceptsIssue,
  defaultSyncRules,
  isSyncPaused,
  readSyncRules,
  type SyncRules,
} from "../../apps/api/src/plugins/sync/rules";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const provider = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock("../../apps/api/src/plugins/sync/provider-issue", () => ({
  providerIssue: async () => provider,
}));

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  provider.read.mockReset().mockResolvedValue({
    title: "Repository title",
    description: "Repository body",
    state: "closed",
    updatedAt: "2026-01-01T00:00:00Z",
  });
  provider.write.mockReset().mockImplementation(async (values) => {
    const current = await provider.read.mock.results.at(-1)!.value;
    provider.read.mockResolvedValue({
      ...current,
      ...values,
      updatedAt: "2026-01-02T00:00:00Z",
    });
    return { updatedAt: "2026-01-02T00:00:00Z" };
  });
});

async function setup(role = "owner") {
  const member = await createWorkspaceMember({ role });
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: "gitea",
      isActive: true,
      config: JSON.stringify({
        baseUrl: "https://git.example",
        accessToken: "test-only",
        repositoryOwner: "team",
        repositoryName: "repo",
      }),
    })
    .returning();
  const [label] = await db
    .insert(schema.labelTable)
    .values({
      workspaceId: member.workspace.id,
      name: "sync",
      color: "#123456",
    })
    .returning();
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Kaneo title",
      description: "Kaneo body",
      status: columns.todo.slug,
      columnId: columns.todo.id,
      number: 1,
    })
    .returning();
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const path = `/api/integration-sync/project/${project.id}/gitea`;
  const rules: SyncRules = {
    outgoing: { mode: "labels", match: "any", labels: [label.id] },
    incoming: { mode: "labels", match: "any", labels: ["sync"] },
  };
  const assign = () =>
    db.insert(schema.labelTable).values({
      taskId: task.id,
      workspaceId: member.workspace.id,
      name: label.name,
      color: label.color,
    });
  const link = async (paused = false) =>
    (
      await db
        .insert(schema.externalLinkTable)
        .values({
          taskId: task.id,
          integrationId: integration.id,
          resourceType: "issue",
          externalId: "9",
          url: "https://git.example/team/repo/issues/9",
          metadata: JSON.stringify({
            syncFilterPaused: paused,
            retained: "preserve-me",
          }),
        })
        .returning()
    )[0]!;
  const request = (
    suffix: string,
    method: string,
    body?: unknown,
    headers?: Record<string, string>,
  ) =>
    app.request(path + suffix, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const setRules = () =>
    db
      .update(schema.integrationTable)
      .set({
        config: JSON.stringify({
          ...JSON.parse(integration.config),
          syncRules: rules,
        }),
      })
      .where(eq(schema.integrationTable.id, integration.id));
  const preview = async (selected = rules) =>
    previewSyncRules(await getSyncIntegration(project.id, "gitea"), selected);
  return {
    ...member,
    project,
    columns,
    integration,
    label,
    task,
    rules,
    assign,
    link,
    request,
    setRules,
    preview,
  };
}

describe("integration label policies", () => {
  it("keeps legacy sync unrestricted and rejects malformed policies", () => {
    expect(readSyncRules("{}")).toEqual(defaultSyncRules);
    expect(
      readSyncRules('{"syncRules":{"outgoing":{"mode":"labels","labels":[]}}}'),
    ).toBeNull();
    expect(
      acceptsIssue(
        {
          syncRules: {
            ...defaultSyncRules,
            incoming: { mode: "labels", match: "all", labels: ["one", "two"] },
          },
        },
        [{ name: "one" }, "two"],
      ),
    ).toBe(true);
    expect(
      acceptsIssue(
        {
          syncRules: {
            ...defaultSyncRules,
            incoming: { mode: "labels", match: "all", labels: ["one", "two"] },
          },
        },
        ["one"],
      ),
    ).toBe(false);
  });

  it("previews any/all matching, missing labels, and new exports", async () => {
    const f = await setup();
    await f.assign();
    const [second] = await db
      .insert(schema.labelTable)
      .values({ workspaceId: f.workspace.id, name: "ready", color: "#123456" })
      .returning();
    const any = {
      ...f.rules,
      outgoing: {
        mode: "labels" as const,
        match: "any" as const,
        labels: [f.label.id, second!.id],
      },
    };
    expect(await f.preview(any)).toMatchObject({
      total: 1,
      matching: 1,
      willCreate: 1,
    });
    expect(
      await f.preview({ ...any, outgoing: { ...any.outgoing, match: "all" } }),
    ).toMatchObject({ matching: 0 });
    expect(
      await f.preview({
        ...any,
        outgoing: { ...any.outgoing, labels: [f.label.id, "missing"] },
      }),
    ).toMatchObject({ matching: 0, missingLabels: ["missing"] });
  });

  it("uses stable workspace label IDs across renames and fails closed during deletion", async () => {
    const f = await setup();
    await f.assign();
    await db
      .update(schema.labelTable)
      .set({ name: "renamed" })
      .where(
        and(
          eq(schema.labelTable.workspaceId, f.workspace.id),
          eq(schema.labelTable.name, "sync"),
        ),
      );
    expect(
      await taskMatchesRule(f.task.id, f.project.id, f.rules.outgoing),
    ).toBe(true);
    await db
      .update(schema.labelTable)
      .set({ deletionStartedAt: new Date() })
      .where(eq(schema.labelTable.id, f.label.id));
    expect(
      await taskMatchesRule(f.task.id, f.project.id, f.rules.outgoing),
    ).toBe(false);
  });

  it("limits eligibility scopes to selected roots while keeping the complete preview picker", async () => {
    const f = await setup();
    await f.assign();
    await db.insert(schema.labelTable).values(
      Array.from({ length: 200 }, (_, index) => ({
        workspaceId: f.workspace.id,
        name: `Unrelated label ${index}`,
        color: "#123456",
      })),
    );
    const scope = await outgoingPredicate(f.workspace.id, f.rules.outgoing);
    expect(scope.labels.map((label) => label.id)).toEqual([f.label.id]);
    expect((await f.preview()).labels).toHaveLength(201);
    expect(
      await taskMatchesRule(f.task.id, f.project.id, f.rules.outgoing),
    ).toBe(true);
    const unrestricted = await outgoingPredicate(f.workspace.id, {
      mode: "all",
    });
    expect(unrestricted.labels).toEqual([]);
    expect((await f.preview(defaultSyncRules)).labels).toHaveLength(201);
    await db
      .update(schema.labelTable)
      .set({ deletionStartedAt: new Date() })
      .where(eq(schema.labelTable.id, f.label.id));
    expect(
      await taskMatchesRule(f.task.id, f.project.id, f.rules.outgoing),
    ).toBe(false);
  });

  it("rejects changed impact rather than applying a stale preview", async () => {
    const f = await setup();
    const preview = await f.preview();
    await f.assign();
    const response = await f.request("", "PATCH", {
      rules: f.rules,
      previewToken: preview.previewToken,
    });
    expect(response.status).toBe(409);
    expect(
      readSyncRules((await getSyncIntegration(f.project.id, "gitea")).config),
    ).toEqual(defaultSyncRules);
  });

  it.each(["unrelated rename", "unrelated color", "selected color"])(
    "saves a reviewed label rule after an %s change",
    async (change) => {
      const f = await setup();
      await f.assign();
      const [other] = await db
        .insert(schema.labelTable)
        .values({
          workspaceId: f.workspace.id,
          name: "Unrelated",
          color: "#123456",
        })
        .returning();
      const preview = await f.preview();
      await db
        .update(schema.labelTable)
        .set(
          change === "unrelated rename"
            ? { name: "Renamed" }
            : { color: "#654321" },
        )
        .where(
          eq(
            schema.labelTable.id,
            change === "selected color" ? f.label.id : other.id,
          ),
        );
      expect(
        (
          await f.request("", "PATCH", {
            rules: f.rules,
            previewToken: preview.previewToken,
          })
        ).status,
      ).toBe(200);
      expect(
        readSyncRules((await getSyncIntegration(f.project.id, "gitea")).config),
      ).toEqual(f.rules);
    },
  );

  it("rejects a selected label rename even when task eligibility is unchanged", async () => {
    const f = await setup();
    await f.assign();
    const preview = await f.preview();
    await db
      .update(schema.labelTable)
      .set({ name: "Renamed" })
      .where(
        and(
          eq(schema.labelTable.workspaceId, f.workspace.id),
          eq(schema.labelTable.name, f.label.name),
        ),
      );
    expect((await f.preview()).matching).toBe(preview.matching);
    expect(
      (
        await f.request("", "PATCH", {
          rules: f.rules,
          previewToken: preview.previewToken,
        })
      ).status,
    ).toBe(409);
  });

  it("rejects labels belonging to another workspace", async () => {
    const f = await setup();
    const other = await createWorkspaceMember();
    const [label] = await db
      .insert(schema.labelTable)
      .values({
        workspaceId: other.workspace.id,
        name: "sync",
        color: "#000000",
      })
      .returning();
    const rules = {
      ...f.rules,
      outgoing: {
        mode: "labels" as const,
        match: "any" as const,
        labels: [label!.id],
      },
    };
    const preview = await f.preview(rules);
    expect(preview.labels.some((item) => item.id === label!.id)).toBe(false);
    expect(
      (
        await f.request("", "PATCH", {
          rules,
          previewToken: preview.previewToken,
        })
      ).status,
    ).toBe(400);
  });

  it("lets members inspect rules but reserves preview and writes for settings managers", async () => {
    const f = await setup("member");
    expect((await f.request("", "GET")).status).toBe(200);
    expect(
      (await f.request("/preview", "POST", { rules: f.rules })).status,
    ).toBe(403);
    expect(
      (
        await f.request("", "PATCH", {
          rules: f.rules,
          previewToken: "a".repeat(64),
        })
      ).status,
    ).toBe(403);
    const outsider = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(outsider.user);
    expect((await f.request("", "GET")).status).toBe(403);
  });

  it("rejects a rule save if the project moves after workspace authorization", async () => {
    const f = await setup();
    const target = await createWorkspaceMember({ role: "owner" });
    const rules = { ...defaultSyncRules, incoming: f.rules.incoming };
    const preview = await f.preview(rules);
    const transaction = getDatabase().transaction.bind(getDatabase());
    vi.spyOn(getDatabase(), "transaction").mockImplementationOnce(
      async (apply, config) => {
        await moveProject(
          f.project.id,
          f.workspace.id,
          target.workspace.id,
          target.user.id,
        );
        return transaction(apply, config);
      },
    );
    const publish = vi
      .spyOn(events, "publishEvent")
      .mockResolvedValue(undefined);
    const response = await f.request("", "PATCH", {
      rules,
      previewToken: preview.previewToken,
    });
    expect(response.status).toBe(403);
    expect(
      await db.query.integrationTable.findFirst({
        where: eq(schema.integrationTable.id, f.integration.id),
      }),
    ).toMatchObject({ config: f.integration.config });
    expect(publish).not.toHaveBeenCalledWith(
      "integration.sync_rules_changed",
      expect.anything(),
    );
  });

  it("returns the authorized workspace's saved preview if the project moves after commit", async () => {
    const f = await setup();
    const target = await createWorkspaceMember({ role: "owner" });
    const [privateLabel] = await db
      .insert(schema.labelTable)
      .values({
        workspaceId: target.workspace.id,
        name: "Private destination label",
        color: "#abcdef",
      })
      .returning();
    const preview = await f.preview(defaultSyncRules);
    vi.spyOn(events, "publishEvent").mockImplementation(async (name) => {
      if (name === "integration.sync_rules_changed")
        await moveProject(
          f.project.id,
          f.workspace.id,
          target.workspace.id,
          target.user.id,
        );
    });
    const response = await f.request("", "PATCH", {
      rules: defaultSyncRules,
      previewToken: preview.previewToken,
    });
    expect(response.status).toBe(200);
    const saved = await response.json();
    expect(saved.labels).toEqual([expect.objectContaining({ id: f.label.id })]);
    expect(JSON.stringify(saved)).not.toContain(privateLabel!.id);
    expect(JSON.stringify(saved)).not.toContain(privateLabel!.name);
    expect(
      await db.query.projectTable.findFirst({
        where: eq(schema.projectTable.id, f.project.id),
      }),
    ).toMatchObject({ workspaceId: target.workspace.id });
  });

  it("pauses excluded links, preserves metadata, and never silently resumes", async () => {
    const f = await setup();
    const link = await f.link();
    const preview = await f.preview();
    expect(preview).toMatchObject({ willPause: 1, matching: 0 });
    await saveSyncRules(
      f.project.id,
      "gitea",
      f.rules,
      preview.previewToken,
      f.workspace.id,
    );
    expect(await canSyncTask(f.task.id, f.integration.id)).toBe(false);
    let stored = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.id, link.id),
    });
    expect(JSON.parse(stored!.metadata!)).toMatchObject({
      syncFilterPaused: true,
      retained: "preserve-me",
    });
    await f.assign();
    expect(await canSyncTask(f.task.id, f.integration.id)).toBe(false);
    expect(await f.preview()).toMatchObject({ needsReview: 1, willCreate: 0 });
    await withIntegrationLink(link, f.integration, async (tx) =>
      tx
        .update(schema.taskTable)
        .set({ title: "Should not be applied" })
        .where(eq(schema.taskTable.id, f.task.id)),
    );
    expect(
      (await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, f.task.id),
      }))!.title,
    ).toBe("Kaneo title");
    stored = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.id, link.id),
    });
    expect(isSyncPaused(stored!.metadata)).toBe(true);
  });

  it("pauses a linked task when its last qualifying label is removed", async () => {
    const f = await setup();
    await f.assign();
    await f.setRules();
    const link = await f.link();
    expect(await canSyncTask(f.task.id, f.integration.id)).toBe(true);
    await db
      .delete(schema.labelTable)
      .where(eq(schema.labelTable.taskId, f.task.id));
    expect(await canSyncTask(f.task.id, f.integration.id)).toBe(false);
    expect(
      isSyncPaused(
        (await db.query.externalLinkTable.findFirst({
          where: eq(schema.externalLinkTable.id, link.id),
        }))!.metadata,
      ),
    ).toBe(true);
  });

  it("counts tasks once even when older duplicate issue links exist", async () => {
    const f = await setup();
    await f.link();
    await f.link(true);
    expect(await f.preview()).toMatchObject({
      total: 1,
      paused: 1,
      willPause: 0,
    });
  });

  it("serializes simultaneous task-created and label events", async () => {
    const f = await setup();
    await f.assign();
    await f.setRules();
    const binding = await getSyncIntegration(f.project.id, "gitea");
    const event = {
      taskId: f.task.id,
      projectId: f.project.id,
      title: "Stale queued title",
      number: 1,
      status: "to-do",
      userId: f.user.id,
      description: null,
      priority: null,
    };
    const context = {
      integrationId: f.integration.id,
      projectId: f.project.id,
      config: JSON.parse(binding.config),
    };
    const create = vi.fn(async (current: typeof event) => {
      expect(current.title).toBe("Kaneo title");
      const existing = await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.taskId, f.task.id),
      });
      if (!existing)
        await createExternalLink({
          taskId: f.task.id,
          integrationId: f.integration.id,
          resourceType: "issue",
          externalId: "123",
          url: "https://git.example/123",
        });
    });
    await Promise.all([
      withTaskSyncCreation(event, context, create),
      withTaskSyncCreation(event, context, create),
    ]);
    expect(create).toHaveBeenCalledOnce();
    expect(
      await db.query.externalLinkTable.findMany({
        where: eq(schema.externalLinkTable.taskId, f.task.id),
      }),
    ).toHaveLength(1);
  });
});

it("pages a large paused scope and preserves metadata across batched rule saves", async () => {
  const f = await setup();
  await f.link();
  const tasks = await db
    .insert(schema.taskTable)
    .values(
      Array.from({ length: 205 }, (_, index) => ({
        projectId: f.project.id,
        number: index + 2,
        title: `Task ${index}`,
      })),
    )
    .returning();
  await db.insert(schema.externalLinkTable).values(
    tasks.map((task) => ({
      taskId: task.id,
      integrationId: f.integration.id,
      resourceType: "issue",
      externalId: String(task.number),
      url: `https://git.example/issues/${task.number}`,
      metadata: JSON.stringify({
        retained: task.id,
        deferredIssueEdit: { id: "old-job" },
      }),
    })),
  );
  const preview = await f.preview();
  expect(preview).toMatchObject({ total: 206, willPause: 206, paused: 206 });
  expect(preview.pausedTasks).toHaveLength(25);
  expect(preview.pausedNextCursor).toBeTruthy();
  await saveSyncRules(
    f.project.id,
    "gitea",
    f.rules,
    preview.previewToken,
    f.workspace.id,
  );
  const links = await db.query.externalLinkTable.findMany();
  expect(links.every((link) => isSyncPaused(link.metadata))).toBe(true);
  expect(
    links.filter(
      (link) => JSON.parse(link.metadata!).deferredIssueEdit?.id === "old-job",
    ),
  ).toHaveLength(205);
  const binding = await getSyncIntegration(f.project.id, "gitea");
  const first = await previewSyncRules(binding, f.rules);
  const second = await previewSyncRules(
    binding,
    f.rules,
    undefined,
    first.pausedNextCursor!,
  );
  expect(second.previewToken).toBe(first.previewToken);
  expect(second.pausedTasks).toHaveLength(25);
  expect(
    second.pausedTasks.every((task) => task.id > first.pausedNextCursor!),
  ).toBe(true);
});

describe("reviewed sync resume", () => {
  async function paused() {
    const f = await setup();
    await f.assign();
    await f.setRules();
    const link = await f.link(true);
    return { ...f, link };
  }
  it("returns not found when disconnect commits between the binding lookups", async () => {
    const f = await paused();
    await expect(
      db.transaction(async (tx) => {
        const load = tx.query.integrationTable.findFirst.bind(
          tx.query.integrationTable,
        );
        vi.spyOn(tx.query.integrationTable, "findFirst").mockImplementationOnce(
          async (config) => {
            const integration = await load(config);
            await db
              .delete(schema.integrationTable)
              .where(eq(schema.integrationTable.id, f.integration.id));
            return integration;
          },
        );
        await lockResumeScope(
          f.project.id,
          "gitea",
          f.link.id,
          f.workspace.id,
          tx,
        );
      }),
    ).rejects.toMatchObject({ status: 404, message: "Linked task not found" });
    expect(
      await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.id, f.link.id),
      }),
    ).toBeUndefined();
    expect(provider.write).not.toHaveBeenCalled();
  });
  it("returns a retryable conflict when another instance retains the resume lease", async () => {
    const f = await paused();
    await db.insert(schema.jobLeaseTable).values({
      name: `sync-resume:${f.link.id}`,
      owner: "crashed-test-instance",
      expiresAt: new Date(Date.now() + 15 * 60_000),
    });
    const response = await f.request(`/links/${f.link.id}/resume`, "POST", {
      source: "kaneo",
      token: "a".repeat(64),
    });
    expect(response.status).toBe(409);
    expect(await response.text()).toBe(
      "Synchronization is busy; retry shortly",
    );
    expect(provider.read).not.toHaveBeenCalled();
    expect(provider.write).not.toHaveBeenCalled();
    expect((await db.query.jobLeaseTable.findFirst())?.owner).toBe(
      "crashed-test-instance",
    );
    expect(
      isSyncPaused(
        (await db.query.externalLinkTable.findFirst({
          where: eq(schema.externalLinkTable.id, f.link.id),
        }))!.metadata,
      ),
    ).toBe(true);
  });
  for (const authentication of ["custom-role", "api-key"] as const) {
    it.each([{}, { project: ["read"] }, { task: ["read"] }] as Array<
      Record<string, string[]>
    >)(
      `${authentication} cannot inspect or mutate sync without both project and task reads: %j`,
      async (readPermissions) => {
        const f = await setup(
          authentication === "custom-role" ? "restricted" : "owner",
        );
        await f.assign();
        await f.setRules();
        const link = await f.link(true);
        const permissions = {
          ...readPermissions,
          workspace: ["manage_settings"],
          task: ["update", ...(readPermissions.task ?? [])],
        };
        const headers: Record<string, string> = {};
        if (authentication === "custom-role") {
          await db.insert(schema.workspaceRoleTable).values({
            workspaceId: f.workspace.id,
            role: "restricted",
            permission: JSON.stringify(permissions),
          });
        } else {
          mockAnonymousSession();
          const key = `kaneo_test_${randomUUID()}`;
          await db.insert(schema.apikeyTable).values({
            referenceId: f.user.id,
            userId: f.user.id,
            key: createHash("sha256").update(key).digest("base64url"),
            name: "scoped sync test",
            permissions: JSON.stringify(permissions),
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          headers.Authorization = `Bearer ${key}`;
        }
        const requests: Array<[string, string, unknown?]> = [
          ["", "GET"],
          ["/preview", "POST", { rules: f.rules }],
          ["", "PATCH", { rules: f.rules, previewToken: "a".repeat(64) }],
          [`/links/${link.id}/review`, "GET"],
          [
            `/links/${link.id}/resume`,
            "POST",
            { source: "kaneo", token: "a".repeat(64) },
          ],
        ];
        for (const [suffix, method, body] of requests) {
          const response = await f.request(suffix, method, body, headers);
          expect(response.status, suffix).toBe(403);
          const text = await response.text();
          expect(text).not.toContain("Kaneo title");
          expect(text).not.toContain("Kaneo body");
          expect(text).not.toContain("Repository title");
        }
        expect(provider.read).not.toHaveBeenCalled();
        expect(provider.write).not.toHaveBeenCalled();
      },
    );
  }
  it.each(["kaneo", "provider"] as const)(
    "reviews and resumes %s values through HTTP with validated responses",
    async (source) => {
      vi.spyOn(events, "publishEvent").mockResolvedValue(undefined);
      const f = await paused();
      const suffix = `/links/${f.link.id}`;
      const response = await f.request(`${suffix}/review`, "GET");
      expect(response.status).toBe(200);
      const review = await response.json();
      expect(review).toMatchObject({
        task: { id: f.task.id, title: "Kaneo title", number: 1 },
        local: {
          title: "Kaneo title",
          description: "Kaneo body",
          state: "open",
        },
        remote: {
          title: "Repository title",
          description: "Repository body",
          state: "closed",
        },
        token: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
      for (const body of [
        { source: "external", token: review.token },
        { source, token: "short" },
      ])
        expect((await f.request(`${suffix}/resume`, "POST", body)).status).toBe(
          400,
        );
      expect(provider.write).not.toHaveBeenCalled();
      const resumed = await f.request(`${suffix}/resume`, "POST", {
        source,
        token: review.token,
      });
      expect(resumed.status).toBe(200);
      expect(await resumed.json()).toEqual({ success: true });
      expect(await canSyncTask(f.task.id, f.integration.id)).toBe(true);
      expect(
        await db.query.externalLinkTable.findFirst({
          where: eq(schema.externalLinkTable.id, f.link.id),
        }),
      ).toMatchObject({
        title: source === "kaneo" ? "Kaneo title" : "Repository title",
      });
    },
  );

  it("denies HTTP review and resume to members and users outside the workspace", async () => {
    const f = await setup("member");
    await f.assign();
    await f.setRules();
    const link = await f.link(true);
    const suffix = `/links/${link.id}`;
    expect((await f.request(`${suffix}/review`, "GET")).status).toBe(403);
    expect(
      (
        await f.request(`${suffix}/resume`, "POST", {
          source: "kaneo",
          token: "a".repeat(64),
        })
      ).status,
    ).toBe(403);
    const outsider = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(outsider.user);
    expect((await f.request(`${suffix}/review`, "GET")).status).toBe(403);
    expect(
      (
        await f.request(`${suffix}/resume`, "POST", {
          source: "kaneo",
          token: "a".repeat(64),
        })
      ).status,
    ).toBe(403);
    expect(provider.read).not.toHaveBeenCalled();
    expect(provider.write).not.toHaveBeenCalled();
  });

  it("requires task update permission in addition to settings permission to resume over HTTP", async () => {
    const f = await setup("settings-only");
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: f.workspace.id,
      role: "settings-only",
      permission: JSON.stringify({
        workspace: ["manage_settings"],
        project: ["read"],
        task: ["read"],
      }),
    });
    await f.assign();
    await f.setRules();
    const link = await f.link(true);
    const response = await f.request(`/links/${link.id}/review`, "GET");
    expect(response.status).toBe(200);
    const { token } = await response.json();
    expect(
      (
        await f.request(`/links/${link.id}/resume`, "POST", {
          source: "provider",
          token,
        })
      ).status,
    ).toBe(403);
    expect(await canSyncTask(f.task.id, f.integration.id)).toBe(false);
    expect(provider.write).not.toHaveBeenCalled();
  });

  it("rejects a stale local comparison before writing to the provider", async () => {
    const f = await paused();
    const review = await reviewSyncResume(
      f.project.id,
      "gitea",
      f.link.id,
      f.workspace.id,
    );
    await db
      .update(schema.taskTable)
      .set({ title: "Changed locally" })
      .where(eq(schema.taskTable.id, f.task.id));
    await expect(
      resumeSync(
        f.project.id,
        "gitea",
        f.link.id,
        review.token,
        "kaneo",
        f.workspace.id,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(provider.write).not.toHaveBeenCalled();
  });

  it.each(["task", "integration", "labels", "link", "project"] as const)(
    "allows %s edits during a provider write and retains an uncertain paused link",
    async (change) => {
      const f = await paused();
      const target =
        change === "project" ? await createWorkspaceMember() : undefined;
      const review = await reviewSyncResume(
        f.project.id,
        "gitea",
        f.link.id,
        f.workspace.id,
      );
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      provider.write.mockImplementation(async () => {
        await gate;
        return { updatedAt: "2026-01-02T00:00:00Z" };
      });
      const resume = resumeSync(
        f.project.id,
        "gitea",
        f.link.id,
        review.token,
        "kaneo",
        f.workspace.id,
      ).then(
        () => undefined,
        (error: unknown) => error,
      );
      try {
        await vi.waitFor(() => expect(provider.write).toHaveBeenCalledOnce());
        const attempts = {
          task: (tx: typeof db) =>
            tx
              .update(schema.taskTable)
              .set({ title: "Concurrent edit" })
              .where(eq(schema.taskTable.id, f.task.id)),
          integration: (tx: typeof db) =>
            tx
              .update(schema.integrationTable)
              .set({ isActive: false })
              .where(eq(schema.integrationTable.id, f.integration.id)),
          labels: (tx: typeof db) =>
            tx
              .delete(schema.labelTable)
              .where(eq(schema.labelTable.taskId, f.task.id)),
          link: (tx: typeof db) =>
            tx
              .update(schema.externalLinkTable)
              .set({ metadata: "{}" })
              .where(eq(schema.externalLinkTable.id, f.link.id)),
          project: (tx: typeof db) =>
            tx
              .update(schema.projectTable)
              .set({ workspaceId: target!.workspace.id })
              .where(eq(schema.projectTable.id, f.project.id)),
        };
        await db.transaction(async (tx) => {
          await tx.execute(sql`set local lock_timeout = '1s'`);
          await attempts[change](tx as typeof db);
        });
        const activity = await db.execute<{ count: number }>(sql`
        select count(*)::int as count from pg_stat_activity
        where datname = current_database() and state = 'idle in transaction'
      `);
        expect(activity.rows[0]!.count).toBe(0);
      } finally {
        release();
      }
      expect(await resume).toMatchObject({
        status: change === "project" ? 403 : 409,
      });
      const stored = await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.id, f.link.id),
      });
      expect(JSON.parse(stored!.metadata!)).toMatchObject({
        syncFilterPaused: true,
        syncResumeUncertain: true,
      });
      if (change === "task")
        expect(
          await db.query.taskTable.findFirst({
            where: eq(schema.taskTable.id, f.task.id),
          }),
        ).toMatchObject({ title: "Concurrent edit" });
    },
  );

  it.each(["review", "kaneo", "provider"] as const)(
    "rejects %s when the project moves after authorization",
    async (source) => {
      const f = await paused();
      const target = await createWorkspaceMember({ role: "owner" });
      await db
        .update(schema.integrationTable)
        .set({
          config: JSON.stringify({
            ...JSON.parse(f.integration.config),
            syncRules: defaultSyncRules,
          }),
        })
        .where(eq(schema.integrationTable.id, f.integration.id));
      const review = await reviewSyncResume(
        f.project.id,
        "gitea",
        f.link.id,
        f.workspace.id,
      );
      const query = getDatabase().query.integrationTable;
      const findFirst = query.findFirst.bind(query);
      vi.spyOn(query, "findFirst").mockImplementationOnce(async (...args) => {
        await moveProject(
          f.project.id,
          f.workspace.id,
          target.workspace.id,
          target.user.id,
        );
        return findFirst(...args);
      });
      const response = await f.request(
        `/links/${f.link.id}/${source === "review" ? "review" : "resume"}`,
        source === "review" ? "GET" : "POST",
        source === "review" ? undefined : { source, token: review.token },
      );
      expect(response.status).toBe(403);
      expect(provider.write).not.toHaveBeenCalled();
      expect(await response.text()).not.toContain("Repository body");
      expect(
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, f.task.id),
        }),
      ).toMatchObject({ title: f.task.title, description: f.task.description });
      expect(
        isSyncPaused(
          (await db.query.externalLinkTable.findFirst({
            where: eq(schema.externalLinkTable.id, f.link.id),
          }))!.metadata,
        ),
      ).toBe(true);
    },
  );

  it.each(["review", "kaneo", "provider"] as const)(
    "rejects %s if the project moves while the provider read is pending",
    async (source) => {
      const f = await paused();
      const target = await createWorkspaceMember({ role: "owner" });
      await db
        .update(schema.integrationTable)
        .set({
          config: JSON.stringify({
            ...JSON.parse(f.integration.config),
            syncRules: defaultSyncRules,
          }),
        })
        .where(eq(schema.integrationTable.id, f.integration.id));
      const review = await reviewSyncResume(
        f.project.id,
        "gitea",
        f.link.id,
        f.workspace.id,
      );
      provider.read.mockImplementationOnce(async () => {
        const activity = await db.execute<{ count: number }>(sql`
          select count(*)::int as count from pg_stat_activity
          where datname = current_database() and state = 'idle in transaction'
        `);
        expect(activity.rows[0]!.count).toBe(0);
        await moveProject(
          f.project.id,
          f.workspace.id,
          target.workspace.id,
          target.user.id,
        );
        return review.snapshot.remoteIssue;
      });
      const response = await f.request(
        `/links/${f.link.id}/${source === "review" ? "review" : "resume"}`,
        source === "review" ? "GET" : "POST",
        source === "review" ? undefined : { source, token: review.token },
      );
      expect(response.status).toBe(403);
      expect(provider.write).not.toHaveBeenCalled();
      expect(await response.text()).not.toContain("Repository body");
      expect(
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, f.task.id),
        }),
      ).toMatchObject({ title: f.task.title, description: f.task.description });
      expect(
        isSyncPaused(
          (await db.query.externalLinkTable.findFirst({
            where: eq(schema.externalLinkTable.id, f.link.id),
          }))!.metadata,
        ),
      ).toBe(true);
    },
  );

  it("allows task edits during the provider read and rejects the stale comparison before dispatch", async () => {
    const f = await paused();
    const review = await reviewSyncResume(
      f.project.id,
      "gitea",
      f.link.id,
      f.workspace.id,
    );
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    provider.read.mockImplementationOnce(async () => {
      await gate;
      return { ...review.remote, updatedAt: review.remoteIssueUpdatedAt };
    });
    provider.read.mockClear();
    const resume = resumeSync(
      f.project.id,
      "gitea",
      f.link.id,
      review.token,
      "kaneo",
      f.workspace.id,
    ).then(
      () => undefined,
      (error: unknown) => error,
    );
    try {
      await vi.waitFor(() => expect(provider.read).toHaveBeenCalledOnce());
      await db.transaction(async (tx) => {
        await tx.execute(sql`set local lock_timeout = '1s'`);
        await tx
          .update(schema.taskTable)
          .set({ title: "Edited during read" })
          .where(eq(schema.taskTable.id, f.task.id));
      });
    } finally {
      release();
    }
    expect(await resume).toMatchObject({ status: 409 });
    expect(provider.write).not.toHaveBeenCalled();
    expect(await canSyncTask(f.task.id, f.integration.id)).toBe(false);
  });

  it("pauses again when a repository edit's webhook was discarded during resume", async () => {
    const f = await paused();
    const review = await reviewSyncResume(
      f.project.id,
      "gitea",
      f.link.id,
      f.workspace.id,
    );
    let remote = review.snapshot.remoteIssue;
    const ignoredWebhook = vi.fn(async () => {
      await db
        .update(schema.taskTable)
        .set({ title: "Edited after read" })
        .where(eq(schema.taskTable.id, f.task.id));
    });
    const publish = vi
      .spyOn(events, "publishEvent")
      .mockResolvedValue(undefined);
    provider.read.mockImplementation(async () => remote);
    provider.read.mockImplementationOnce(async () => {
      const snapshot = remote;
      remote = {
        ...remote,
        title: "Edited after read",
        updatedAt: "new-provider-version",
      };
      await withIntegrationLink(f.link, f.integration, ignoredWebhook);
      return snapshot;
    });
    await expect(
      resumeSync(
        f.project.id,
        "gitea",
        f.link.id,
        review.token,
        "provider",
        f.workspace.id,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(ignoredWebhook).not.toHaveBeenCalled();
    expect(await canSyncTask(f.task.id, f.integration.id)).toBe(false);
    expect(provider.write).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith(
      "task.updated",
      expect.objectContaining({ taskId: f.task.id }),
    );
    const followUp = await reviewSyncResume(
      f.project.id,
      "gitea",
      f.link.id,
      f.workspace.id,
    );
    expect(followUp.local.title).toBe(review.remote.title);
    expect(followUp.remote.title).toBe("Edited after read");
  });

  it.each(
    (["title", "description", "state"] as const).flatMap((field) =>
      (["partial-write", "concurrent-edit"] as const).map((cause) => ({
        field,
        cause,
      })),
    ),
  )(
    "pauses Kaneo resume when $cause leaves $field different from the selected values",
    async ({ field, cause }) => {
      const f = await paused();
      const review = await reviewSyncResume(
        f.project.id,
        "gitea",
        f.link.id,
        f.workspace.id,
      );
      let remote = review.snapshot.remoteIssue;
      const webhook = vi.fn();
      provider.read.mockImplementation(async () => {
        const activity = await db.execute<{ count: number }>(sql`
          select count(*)::int as count from pg_stat_activity
          where datname = current_database() and state = 'idle in transaction'
        `);
        expect(activity.rows[0]!.count).toBe(0);
        return remote;
      });
      provider.write.mockImplementationOnce(async (values) => {
        remote = {
          ...remote,
          ...values,
          [field]:
            cause === "partial-write"
              ? remote[field]
              : field === "state"
                ? "closed"
                : "Concurrent repository edit",
          updatedAt: "new-provider-version",
        };
        if (cause === "concurrent-edit")
          await withIntegrationLink(f.link, f.integration, webhook);
        return { updatedAt: remote.updatedAt };
      });
      await expect(
        resumeSync(
          f.project.id,
          "gitea",
          f.link.id,
          review.token,
          "kaneo",
          f.workspace.id,
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(provider.write).toHaveBeenCalledWith(review.local);
      expect(webhook).not.toHaveBeenCalled();
      expect(await canSyncTask(f.task.id, f.integration.id)).toBe(false);
      const followUp = await reviewSyncResume(
        f.project.id,
        "gitea",
        f.link.id,
        f.workspace.id,
      );
      expect(followUp.local).toEqual(review.local);
      expect(followUp.remote[field]).not.toBe(review.local[field]);
    },
  );

  it("verifies adopted repository values outside locks without replaying labels", async () => {
    const f = await paused();
    provider.read.mockResolvedValue({
      title: "Repository title",
      description: "Repository body",
      state: "closed",
      updatedAt: "2026-01-01T00:00:00Z",
      labels: ["priority:low", "custom"],
    });
    const review = await reviewSyncResume(
      f.project.id,
      "gitea",
      f.link.id,
      f.workspace.id,
    );
    provider.read.mockResolvedValueOnce(review.snapshot.remoteIssue);
    provider.read.mockImplementationOnce(async () => {
      expect(await canSyncTask(f.task.id, f.integration.id)).toBe(true);
      const activity = await db.execute<{ count: number }>(sql`
        select count(*)::int as count from pg_stat_activity
        where datname = current_database() and state = 'idle in transaction'
      `);
      expect(activity.rows[0]!.count).toBe(0);
      return {
        ...review.snapshot.remoteIssue,
        labels: ["custom", "priority:low", "custom"],
        updatedAt: "new-version",
      };
    });
    await expect(
      resumeSync(
        f.project.id,
        "gitea",
        f.link.id,
        review.token,
        "provider",
        f.workspace.id,
      ),
    ).resolves.toEqual({ success: true });
    expect(provider.read).toHaveBeenCalledTimes(3);
    expect(
      await db.query.labelTable.findMany({
        where: eq(schema.labelTable.taskId, f.task.id),
      }),
    ).toEqual([expect.objectContaining({ name: f.label.name })]);
  });

  it.each(
    ["kaneo", "provider"].flatMap((source) =>
      ["priority", "status", "custom"].map((field) => ({ source, field })),
    ),
  )(
    "pauses $source resume when $field labels change during the handoff",
    async ({ source, field }) => {
      const f = await paused();
      const labels = ["priority:low", "status:planned", "custom:old"];
      const changed = labels.map((label) =>
        label.startsWith(`${field}:`) ? `${field}:new` : label,
      );
      provider.read.mockResolvedValue({
        title: "Repository title",
        description: "Repository body",
        state: "open",
        updatedAt: "2026-01-01T00:00:00Z",
        labels,
      });
      const review = await reviewSyncResume(
        f.project.id,
        "gitea",
        f.link.id,
        f.workspace.id,
      );
      provider.read.mockResolvedValueOnce(review.snapshot.remoteIssue);
      provider.read.mockImplementationOnce(async () => {
        expect(await canSyncTask(f.task.id, f.integration.id)).toBe(true);
        return { ...review.snapshot.remoteIssue, labels: changed };
      });
      await expect(
        resumeSync(
          f.project.id,
          "gitea",
          f.link.id,
          review.token,
          source as "kaneo" | "provider",
          f.workspace.id,
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(await canSyncTask(f.task.id, f.integration.id)).toBe(false);
      expect(
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, f.task.id),
        }),
      ).toMatchObject({ priority: f.task.priority, status: f.task.status });
      expect(
        await db.query.labelTable.findMany({
          where: eq(schema.labelTable.taskId, f.task.id),
        }),
      ).toEqual([expect.objectContaining({ name: f.label.name })]);
    },
  );

  it("keeps adoption paused if the verification read fails without exposing provider secrets", async () => {
    const f = await paused();
    const review = await reviewSyncResume(
      f.project.id,
      "gitea",
      f.link.id,
      f.workspace.id,
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    provider.read.mockResolvedValueOnce(review.snapshot.remoteIssue);
    provider.read.mockRejectedValueOnce(
      new Error("private-provider-token-and-response"),
    );
    await expect(
      resumeSync(
        f.project.id,
        "gitea",
        f.link.id,
        review.token,
        "provider",
        f.workspace.id,
      ),
    ).rejects.toMatchObject({ status: 502 });
    expect(await canSyncTask(f.task.id, f.integration.id)).toBe(false);
    expect(JSON.stringify(log.mock.calls)).not.toContain(
      "private-provider-token-and-response",
    );
  });

  it("records an uncertain provider write when the dispatch transaction fails", async () => {
    const f = await paused();
    const review = await reviewSyncResume(
      f.project.id,
      "gitea",
      f.link.id,
      f.workspace.id,
    );
    const transaction = getDatabase().transaction.bind(getDatabase());
    vi.spyOn(getDatabase(), "transaction").mockImplementationOnce(
      (apply, config) =>
        transaction(async (tx) => {
          await apply(tx);
          throw new Error("Injected dispatch transaction failure");
        }, config),
    );
    await expect(
      resumeSync(
        f.project.id,
        "gitea",
        f.link.id,
        review.token,
        "kaneo",
        f.workspace.id,
      ),
    ).rejects.toThrow("Injected dispatch transaction failure");
    expect(provider.write).toHaveBeenCalledOnce();
    const stored = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.id, f.link.id),
    });
    expect(JSON.parse(stored!.metadata!)).toMatchObject({
      syncFilterPaused: true,
      syncResumeUncertain: true,
    });
  });

  it.each(["planned", "archived"])(
    "keeps an open %s task in its virtual status when adopting repository text",
    async (status) => {
      const f = await paused();
      await db
        .update(schema.taskTable)
        .set({ status, columnId: null })
        .where(eq(schema.taskTable.id, f.task.id));
      provider.read.mockResolvedValue({
        title: "Repository title",
        description: "Repository body",
        state: "open",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      const publish = vi
        .spyOn(events, "publishEvent")
        .mockResolvedValue(undefined);
      const review = await reviewSyncResume(
        f.project.id,
        "gitea",
        f.link.id,
        f.workspace.id,
      );
      expect(review.local.state).toBe("open");
      await resumeSync(
        f.project.id,
        "gitea",
        f.link.id,
        review.token,
        "provider",
        f.workspace.id,
      );
      expect(
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, f.task.id),
        }),
      ).toMatchObject({
        status,
        columnId: null,
        title: "Repository title",
        description: "Repository body",
      });
      expect(
        publish.mock.calls.some(([name]) => name === "task.status_changed"),
      ).toBe(false);
    },
  );
  it("adopts repository values and completion state using the existing link", async () => {
    const publish = vi
      .spyOn(events, "publishEvent")
      .mockResolvedValue(undefined);
    const f = await paused();
    await db
      .update(schema.taskTable)
      .set({ userId: f.user.id })
      .where(eq(schema.taskTable.id, f.task.id));
    const review = await reviewSyncResume(
      f.project.id,
      "gitea",
      f.link.id,
      f.workspace.id,
    );
    expect(review.local.title).toBe("Kaneo title");
    await resumeSync(
      f.project.id,
      "gitea",
      f.link.id,
      review.token,
      "provider",
      f.workspace.id,
    );
    const task = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, f.task.id),
    });
    expect(task).toMatchObject({
      title: "Repository title",
      description: "Repository body",
      columnId: f.columns.done.id,
    });
    expect(provider.write).not.toHaveBeenCalled();
    expect(
      await db.query.activityTable.findFirst({
        where: and(
          eq(schema.activityTable.taskId, f.task.id),
          eq(schema.activityTable.type, "title_changed"),
        ),
      }),
    ).toMatchObject({
      eventData: { oldTitle: "Kaneo title", newTitle: "Repository title" },
    });
    expect(publish).toHaveBeenCalledWith(
      "task.title_changed",
      expect.objectContaining({
        sourceIntegrationId: f.integration.id,
        oldTitle: "Kaneo title",
        newTitle: "Repository title",
      }),
    );
    expect(publish).toHaveBeenCalledWith(
      "task.description_changed",
      expect.objectContaining({
        sourceIntegrationId: f.integration.id,
        newDescription: "Repository body",
      }),
    );
    expect(publish).toHaveBeenCalledWith(
      "task.status_changed",
      expect.objectContaining({
        sourceIntegrationId: f.integration.id,
        assigneeId: f.user.id,
        taskId: f.task.id,
        oldStatus: f.columns.todo.slug,
        newStatus: f.columns.done.slug,
        title: "Repository title",
      }),
    );
    expect(await canSyncTask(f.task.id, f.integration.id)).toBe(true);
    expect(
      await db.query.externalLinkTable.findMany({
        where: eq(schema.externalLinkTable.taskId, f.task.id),
      }),
    ).toHaveLength(1);
    expect(
      (
        await db.query.externalLinkTable.findFirst({
          where: eq(schema.externalLinkTable.id, f.link.id),
        })
      )?.title,
    ).toBe("Repository title");
  });
  it("keeps Kaneo values only after the repository update succeeds", async () => {
    const f = await paused();
    const review = await reviewSyncResume(
      f.project.id,
      "gitea",
      f.link.id,
      f.workspace.id,
    );
    await resumeSync(
      f.project.id,
      "gitea",
      f.link.id,
      review.token,
      "kaneo",
      f.workspace.id,
    );
    expect(provider.write).toHaveBeenCalledWith({
      title: "Kaneo title",
      description: "Kaneo body",
      state: "open",
    });
    expect(await canSyncTask(f.task.id, f.integration.id)).toBe(true);
    expect(
      (
        await db.query.externalLinkTable.findFirst({
          where: eq(schema.externalLinkTable.id, f.link.id),
        })
      )?.title,
    ).toBe("Kaneo title");
  });
  it("preserves a GitLab task's chosen column through its reopen echo", async () => {
    const f = await paused();
    await db
      .update(schema.integrationTable)
      .set({
        type: "gitlab",
        config: JSON.stringify({
          baseUrl: "https://git.example",
          accessToken: "test-only",
          projectPath: "team/repo",
          syncRules: f.rules,
        }),
      })
      .where(eq(schema.integrationTable.id, f.integration.id));
    await db
      .update(schema.taskTable)
      .set({
        status: f.columns.inProgress.slug,
        columnId: f.columns.inProgress.id,
      })
      .where(eq(schema.taskTable.id, f.task.id));
    const review = await reviewSyncResume(
      f.project.id,
      "gitlab",
      f.link.id,
      f.workspace.id,
    );
    await resumeSync(
      f.project.id,
      "gitlab",
      f.link.id,
      review.token,
      "kaneo",
      f.workspace.id,
    );
    const link = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.id, f.link.id),
    });
    expect(JSON.parse(link!.metadata!)).toMatchObject({ state: "opened" });
    await handleGitlabIssueReopened(
      {
        object_attributes: {
          iid: 9,
          title: "Kaneo title",
          url: link!.url,
          state: "opened",
          action: "reopen",
          updated_at: new Date().toISOString(),
        },
        project: {
          path_with_namespace: "team/repo",
          web_url: "https://git.example/team/repo",
        },
      },
      f.integration.id,
    );
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, f.task.id),
      }),
    ).toMatchObject({
      status: f.columns.inProgress.slug,
      columnId: f.columns.inProgress.id,
    });
  });
  it("runs mention notifications and asset cleanup when adopting repository text", async () => {
    vi.spyOn(events, "publishEvent").mockResolvedValue(undefined);
    const cleanup = vi
      .spyOn(assets, "deleteOrphanedAssets")
      .mockResolvedValue(undefined);
    const f = await paused();
    provider.read.mockResolvedValue({
      title: "Repository title",
      description: `<kaneo-mention id="${f.user.id}">Team member</kaneo-mention>`,
      state: "closed",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    const review = await reviewSyncResume(
      f.project.id,
      "gitea",
      f.link.id,
      f.workspace.id,
    );
    await resumeSync(
      f.project.id,
      "gitea",
      f.link.id,
      review.token,
      "provider",
      f.workspace.id,
    );
    expect(cleanup).toHaveBeenCalledWith(
      "Kaneo body",
      review.remote.description,
      { taskId: f.task.id },
    );
    expect(
      await db.query.notificationTable.findFirst({
        where: and(
          eq(schema.notificationTable.resourceId, f.task.id),
          eq(schema.notificationTable.type, "task_mention"),
        ),
      }),
    ).toMatchObject({ userId: f.user.id });
  });
  it("requires a fresh comparison after either side changes", async () => {
    const f = await paused();
    const review = await reviewSyncResume(
      f.project.id,
      "gitea",
      f.link.id,
      f.workspace.id,
    );
    provider.read.mockResolvedValue({
      ...review.remote,
      title: "Changed remotely",
      updatedAt: "2026-01-03T00:00:00Z",
    });
    await expect(
      resumeSync(
        f.project.id,
        "gitea",
        f.link.id,
        review.token,
        "kaneo",
        f.workspace.id,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(provider.write).not.toHaveBeenCalled();
    expect(await canSyncTask(f.task.id, f.integration.id)).toBe(false);
  });
  it("records an uncertain resume and refreshes clients if local commit fails after the provider write", async () => {
    const f = await paused();
    const review = await reviewSyncResume(
      f.project.id,
      "gitea",
      f.link.id,
      f.workspace.id,
    );
    vi.spyOn(linkManager, "updateExternalLink").mockRejectedValueOnce(
      new Error("Local metadata commit failed"),
    );
    const publish = vi.spyOn(events, "publishEvent");
    await expect(
      resumeSync(
        f.project.id,
        "gitea",
        f.link.id,
        review.token,
        "kaneo",
        f.workspace.id,
      ),
    ).rejects.toThrow("Local metadata commit failed");
    expect(provider.write).toHaveBeenCalledOnce();
    const link = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.id, f.link.id),
    });
    expect(JSON.parse(link!.metadata!)).toMatchObject({
      syncFilterPaused: true,
      syncResumeUncertain: true,
    });
    expect(publish).toHaveBeenCalledWith("project.updated", {
      projectId: f.project.id,
    });
    expect(publish).toHaveBeenCalledWith("task.updated", {
      projectId: f.project.id,
      taskId: f.task.id,
    });
  });

  it("keeps the link paused when a provider request fails", async () => {
    const f = await paused();
    const review = await reviewSyncResume(
      f.project.id,
      "gitea",
      f.link.id,
      f.workspace.id,
    );
    provider.write.mockRejectedValue(new Error("offline"));
    await expect(
      resumeSync(
        f.project.id,
        "gitea",
        f.link.id,
        review.token,
        "kaneo",
        f.workspace.id,
      ),
    ).rejects.toMatchObject({ status: 502 });
    expect(await canSyncTask(f.task.id, f.integration.id)).toBe(false);
  });
  it.each(["read", "write"] as const)(
    "logs the failed resume %s stage without provider secrets",
    async (stage) => {
      const f = await paused();
      const review = await reviewSyncResume(
        f.project.id,
        "gitea",
        f.link.id,
        f.workspace.id,
      );
      const failure = Object.assign(new Error("private-provider-response"), {
        request: { headers: { authorization: "fake-test-secret" } },
      });
      provider[stage].mockRejectedValue(failure);
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const response = await f.request(
          `/links/${f.link.id}/${stage === "read" ? "review" : "resume"}`,
          stage === "read" ? "GET" : "POST",
          stage === "read"
            ? undefined
            : { source: "kaneo", token: review.token },
        );
        expect(response.status).toBe(502);
        expect(await response.text()).not.toContain(
          "private-provider-response",
        );
        expect(log).toHaveBeenCalledWith(
          `Sync resume provider ${stage} failed`,
          {
            projectId: f.project.id,
            provider: "gitea",
            linkId: f.link.id,
          },
        );
        expect(JSON.stringify(log.mock.calls)).not.toContain(
          "fake-test-secret",
        );
        expect(JSON.stringify(log.mock.calls)).not.toContain(
          "private-provider-response",
        );
      } finally {
        log.mockRestore();
      }
    },
  );
  it("does not review an excluded task or a link from another integration", async () => {
    const f = await paused();
    await db
      .delete(schema.labelTable)
      .where(eq(schema.labelTable.taskId, f.task.id));
    await expect(
      reviewSyncResume(f.project.id, "gitea", f.link.id, f.workspace.id),
    ).rejects.toMatchObject({ status: 409 });
    const other = await setup();
    await expect(
      reviewSyncResume(
        other.project.id,
        "gitea",
        f.link.id,
        other.workspace.id,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(provider.read).not.toHaveBeenCalled();
  });
});

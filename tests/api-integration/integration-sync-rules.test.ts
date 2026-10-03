import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { getSyncIntegration } from "../../apps/api/src/integration-sync/controllers/get-integration";
import { previewSyncRules } from "../../apps/api/src/integration-sync/controllers/preview-rules";
import { resumeSync } from "../../apps/api/src/integration-sync/controllers/resume-sync";
import { reviewSyncResume } from "../../apps/api/src/integration-sync/controllers/review-resume";
import { saveSyncRules } from "../../apps/api/src/integration-sync/controllers/save-rules";
import { createExternalLink } from "../../apps/api/src/plugins/github/services/link-manager";
import { withIntegrationTask } from "../../apps/api/src/plugins/github/services/integration-task-scope";
import { withTaskSyncCreation } from "../../apps/api/src/plugins/sync/create-task-issue";
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
import { mockAuthenticatedSession } from "./helpers/auth";
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
  provider.read.mockResolvedValue({
    title: "Repository title",
    description: "Repository body",
    state: "closed",
    updatedAt: "2026-01-01T00:00:00Z",
  });
  provider.write.mockResolvedValue({ updatedAt: "2026-01-02T00:00:00Z" });
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
  const request = (suffix: string, method: string, body?: unknown) =>
    app.request(path + suffix, {
      method,
      headers: { "Content-Type": "application/json" },
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

  it("pauses excluded links, preserves metadata, and never silently resumes", async () => {
    const f = await setup();
    const link = await f.link();
    const preview = await f.preview();
    expect(preview).toMatchObject({ willPause: 1, matching: 0 });
    await saveSyncRules(f.project.id, "gitea", f.rules, preview.previewToken);
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
    await withIntegrationTask(f.task.id, f.integration, async (tx) =>
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

describe("reviewed sync resume", () => {
  async function paused() {
    const f = await setup();
    await f.assign();
    await f.setRules();
    const link = await f.link(true);
    return { ...f, link };
  }
  it("adopts repository values and completion state using the existing link", async () => {
    const f = await paused();
    const review = await reviewSyncResume(f.project.id, "gitea", f.link.id);
    expect(review.local.title).toBe("Kaneo title");
    await resumeSync(
      f.project.id,
      "gitea",
      f.link.id,
      review.token,
      "provider",
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
    expect(await canSyncTask(f.task.id, f.integration.id)).toBe(true);
    expect(
      await db.query.externalLinkTable.findMany({
        where: eq(schema.externalLinkTable.taskId, f.task.id),
      }),
    ).toHaveLength(1);
  });
  it("keeps Kaneo values only after the repository update succeeds", async () => {
    const f = await paused();
    const review = await reviewSyncResume(f.project.id, "gitea", f.link.id);
    await resumeSync(f.project.id, "gitea", f.link.id, review.token, "kaneo");
    expect(provider.write).toHaveBeenCalledWith({
      title: "Kaneo title",
      description: "Kaneo body",
      state: "open",
    });
    expect(await canSyncTask(f.task.id, f.integration.id)).toBe(true);
  });
  it("requires a fresh comparison after either side changes", async () => {
    const f = await paused();
    const review = await reviewSyncResume(f.project.id, "gitea", f.link.id);
    provider.read.mockResolvedValue({
      ...review.remote,
      title: "Changed remotely",
      updatedAt: "2026-01-03T00:00:00Z",
    });
    await expect(
      resumeSync(f.project.id, "gitea", f.link.id, review.token, "kaneo"),
    ).rejects.toMatchObject({ status: 409 });
    expect(provider.write).not.toHaveBeenCalled();
    expect(await canSyncTask(f.task.id, f.integration.id)).toBe(false);
  });
  it("keeps the link paused when a provider request fails", async () => {
    const f = await paused();
    const review = await reviewSyncResume(f.project.id, "gitea", f.link.id);
    provider.write.mockRejectedValue(new Error("offline"));
    await expect(
      resumeSync(f.project.id, "gitea", f.link.id, review.token, "kaneo"),
    ).rejects.toMatchObject({ status: 502 });
    expect(await canSyncTask(f.task.id, f.integration.id)).toBe(false);
  });
  it("does not review an excluded task or a link from another integration", async () => {
    const f = await paused();
    await db
      .delete(schema.labelTable)
      .where(eq(schema.labelTable.taskId, f.task.id));
    await expect(
      reviewSyncResume(f.project.id, "gitea", f.link.id),
    ).rejects.toMatchObject({ status: 409 });
    const other = await setup();
    await expect(
      reviewSyncResume(other.project.id, "gitea", f.link.id),
    ).rejects.toMatchObject({ status: 404 });
    expect(provider.read).not.toHaveBeenCalled();
  });
});

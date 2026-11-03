import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import * as events from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { integrationPlugins } from "../../apps/api/src/plugins";
import * as outcomes from "../../apps/api/src/plugins/tangled/record-outcome";
import { loadTangledConnection } from "../../apps/api/src/plugins/tangled/connection";
import { reconcileTangledBranch } from "../../apps/api/src/plugins/tangled/reconcile-branch";
import moveTask from "../../apps/api/src/task/controllers/move-task";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import {
  createTangledFixture as fixture,
  tangledTestConfig as config,
} from "./helpers/tangled";

const upstream = vi.hoisted(() => ({
  available: true,
  missing: false,
  head: "b".repeat(40),
}));
vi.mock("../../apps/api/src/plugins/tangled/request-json", () => {
  class TangledRefNotFoundError extends Error {}
  return {
    TangledRefNotFoundError,
    requestTangledJson: async (url: URL) => {
      if (!upstream.available) throw new Error("private-upstream-error");
      if (url.pathname.endsWith("getRepoByRepoDid"))
        return {
          uri: "at://did:plc:repository/org.tangled.repo.manifest/self",
          value: {
            $type: "org.tangled.repo.manifest",
            declaration: { owner: "did:plc:owner", name: "repo" },
          },
        };
      if (url.pathname.endsWith("getRef")) {
        if (upstream.missing) throw new TangledRefNotFoundError();
        return { name: url.searchParams.get("ref"), oid: upstream.head };
      }
      throw new Error("Unexpected upstream request");
    },
  };
});

function payload(ref = "refs/heads/KAN-12") {
  return {
    ref,
    before: "a".repeat(40),
    after: "a".repeat(40),
    repository: { full_name: config.repositoryFullName },
  };
}

function deliver(
  app: ReturnType<typeof createApp>["app"],
  id: string,
  body: string,
  event = "push",
  headers: Record<string, string> = {},
) {
  const signature = `sha256=${createHmac("sha256", config.webhookSecret).update(body).digest("hex")}`;
  return app.request(`/api/tangled-integration/webhook/${id}`, {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "x-tangled-event": event,
      "x-tangled-signature-256": signature,
      ...headers,
    },
  });
}

beforeEach(async () => {
  await resetTestDatabase();
  upstream.available = true;
  upstream.missing = false;
  upstream.head = "b".repeat(40);
  mockAnonymousSession();
});

describe("Tangled webhook delivery", () => {
  it("moves a matching task only when a Tangled branch rule exists", async () => {
    const context = await fixture();
    const target = await db.query.columnTable.findFirst({
      where: and(
        eq(schema.columnTable.projectId, context.project.id),
        eq(schema.columnTable.slug, "in-progress"),
      ),
    });
    await db.insert(schema.workflowRuleTable).values({
      projectId: context.project.id,
      integrationType: "tangled",
      eventType: "branch_push",
      columnId: target!.id,
    });
    const statuses: unknown[] = [];
    const relationRefreshes: unknown[] = [];
    vi.spyOn(events, "publishEvent").mockImplementation(async (type, data) => {
      if (type === "task.status_changed") statuses.push(data);
      if (type === "task-relation.refresh") relationRefreshes.push(data);
    });
    const { app } = createApp();
    expect(
      (await deliver(app, context.integration.id, JSON.stringify(payload())))
        .status,
    ).toBe(200);
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, context.task.id),
      }),
    ).toMatchObject({ status: "in-progress", columnId: target!.id });
    expect(statuses).toMatchObject([
      { taskId: context.task.id, oldStatus: "done", newStatus: "in-progress" },
    ]);
    expect(relationRefreshes).toMatchObject([
      { projectId: context.project.id },
    ]);
    expect(
      (await deliver(app, context.integration.id, JSON.stringify(payload())))
        .status,
    ).toBe(200);
    expect(statuses).toHaveLength(1);
    expect(relationRefreshes).toHaveLength(1);
  });

  it("publishes updates when a workflow changes only the column of a linked task", async () => {
    const context = await fixture();
    const { app } = createApp();
    const body = JSON.stringify(payload());
    expect((await deliver(app, context.integration.id, body)).status).toBe(200);
    const done = await db.query.columnTable.findFirst({
      where: and(
        eq(schema.columnTable.projectId, context.project.id),
        eq(schema.columnTable.slug, "done"),
      ),
    });
    await db.insert(schema.workflowRuleTable).values({
      projectId: context.project.id,
      integrationType: "tangled",
      eventType: "branch_push",
      columnId: done!.id,
    });
    const published: string[] = [];
    vi.spyOn(events, "publishEvent").mockImplementation(async (type) => {
      published.push(type);
    });

    expect((await deliver(app, context.integration.id, body)).status).toBe(200);
    expect(await db.query.taskTable.findFirst()).toMatchObject({
      status: "done",
      columnId: done!.id,
    });
    expect(published).toContain("task.updated");
    expect(published).toContain("task-relation.refresh");
    expect(published).not.toContain("task.status_changed");
  });

  it("preserves a manual status after a push linked the branch before automation existed", async () => {
    const context = await fixture();
    const { app } = createApp();
    expect(
      (await deliver(app, context.integration.id, JSON.stringify(payload())))
        .status,
    ).toBe(200);
    await db
      .update(schema.taskTable)
      .set({ status: "to-do", columnId: null })
      .where(eq(schema.taskTable.id, context.task.id));
    const target = await db.query.columnTable.findFirst({
      where: and(
        eq(schema.columnTable.projectId, context.project.id),
        eq(schema.columnTable.slug, "in-progress"),
      ),
    });
    await db.insert(schema.workflowRuleTable).values({
      projectId: context.project.id,
      integrationType: "tangled",
      eventType: "branch_push",
      columnId: target!.id,
    });
    upstream.head = "c".repeat(40);

    expect(
      (await deliver(app, context.integration.id, JSON.stringify(payload())))
        .status,
    ).toBe(200);

    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, context.task.id),
      }),
    ).toMatchObject({ status: "to-do" });
  });

  it("applies the destination workflow after a task moves to another project", async () => {
    const context = await fixture();
    const sourceTarget = await db.query.columnTable.findFirst({
      where: and(
        eq(schema.columnTable.projectId, context.project.id),
        eq(schema.columnTable.slug, "in-progress"),
      ),
    });
    await db.insert(schema.workflowRuleTable).values({
      projectId: context.project.id,
      integrationType: "tangled",
      eventType: "branch_push",
      columnId: sourceTarget!.id,
    });
    const { app } = createApp();
    expect(
      (await deliver(app, context.integration.id, JSON.stringify(payload())))
        .status,
    ).toBe(200);
    const destination = await createProjectFixture({
      workspaceId: context.workspace.id,
      slug: "DST",
    });
    const [destinationIntegration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: destination.project.id,
        type: "tangled",
        isActive: true,
        config: JSON.stringify(config),
      })
      .returning();
    const destinationTarget = await db.query.columnTable.findFirst({
      where: and(
        eq(schema.columnTable.projectId, destination.project.id),
        eq(schema.columnTable.slug, "in-progress"),
      ),
    });
    await db.insert(schema.workflowRuleTable).values({
      projectId: destination.project.id,
      integrationType: "tangled",
      eventType: "branch_push",
      columnId: destinationTarget!.id,
    });
    const { task: moved } = await moveTask({
      taskId: context.task.id,
      destinationProjectId: destination.project.id,
      destinationStatus: "to-do",
      currentUserId: context.user.id,
    });

    expect(
      (
        await deliver(
          app,
          destinationIntegration!.id,
          JSON.stringify(payload(`refs/heads/DST-${moved.number}`)),
        )
      ).status,
    ).toBe(200);

    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, context.task.id),
      }),
    ).toMatchObject({
      projectId: destination.project.id,
      status: "in-progress",
      columnId: destinationTarget!.id,
    });
  });

  it("preserves a manual status change on later pushes even after moving away and back", async () => {
    const context = await fixture();
    const target = await db.query.columnTable.findFirst({
      where: and(
        eq(schema.columnTable.projectId, context.project.id),
        eq(schema.columnTable.slug, "in-progress"),
      ),
    });
    await db.insert(schema.workflowRuleTable).values({
      projectId: context.project.id,
      integrationType: "tangled",
      eventType: "branch_push",
      columnId: target!.id,
    });
    const { app } = createApp();
    expect(
      (await deliver(app, context.integration.id, JSON.stringify(payload())))
        .status,
    ).toBe(200);
    await db
      .update(schema.taskTable)
      .set({ status: "to-do", columnId: null })
      .where(eq(schema.taskTable.id, context.task.id));
    await db
      .update(schema.taskTable)
      .set({ status: "in-progress", columnId: target!.id })
      .where(eq(schema.taskTable.id, context.task.id));
    const done = await db.query.columnTable.findFirst({
      where: and(
        eq(schema.columnTable.projectId, context.project.id),
        eq(schema.columnTable.slug, "done"),
      ),
    });
    await db
      .update(schema.workflowRuleTable)
      .set({ columnId: done!.id })
      .where(eq(schema.workflowRuleTable.projectId, context.project.id));
    upstream.head = "c".repeat(40);
    expect(
      (await deliver(app, context.integration.id, JSON.stringify(payload())))
        .status,
    ).toBe(200);
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, context.task.id),
      }),
    ).toMatchObject({ status: "in-progress", columnId: target!.id });
  });

  it("preserves a manual status across different matching branches", async () => {
    const context = await fixture();
    const target = await db.query.columnTable.findFirst({
      where: and(
        eq(schema.columnTable.projectId, context.project.id),
        eq(schema.columnTable.slug, "in-progress"),
      ),
    });
    await db.insert(schema.workflowRuleTable).values({
      projectId: context.project.id,
      integrationType: "tangled",
      eventType: "branch_push",
      columnId: target!.id,
    });
    const { app } = createApp();
    expect(
      (
        await deliver(
          app,
          context.integration.id,
          JSON.stringify(payload("refs/heads/KAN-12-first")),
        )
      ).status,
    ).toBe(200);
    await db
      .update(schema.taskTable)
      .set({ status: "done", columnId: null })
      .where(eq(schema.taskTable.id, context.task.id));
    const responses = await Promise.all(
      ["second", "third"].map((suffix) =>
        deliver(
          app,
          context.integration.id,
          JSON.stringify(payload(`refs/heads/KAN-12-${suffix}`)),
        ),
      ),
    );
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, context.task.id),
      }),
    ).toMatchObject({ status: "done" });
  });

  it("does not invalidate status ownership for an unrelated title edit", async () => {
    const context = await fixture();
    const inProgress = await db.query.columnTable.findFirst({
      where: and(
        eq(schema.columnTable.projectId, context.project.id),
        eq(schema.columnTable.slug, "in-progress"),
      ),
    });
    const done = await db.query.columnTable.findFirst({
      where: and(
        eq(schema.columnTable.projectId, context.project.id),
        eq(schema.columnTable.slug, "done"),
      ),
    });
    await db.insert(schema.workflowRuleTable).values({
      projectId: context.project.id,
      integrationType: "tangled",
      eventType: "branch_push",
      columnId: inProgress!.id,
    });
    const { app } = createApp();
    expect(
      (await deliver(app, context.integration.id, JSON.stringify(payload())))
        .status,
    ).toBe(200);
    await db
      .update(schema.taskTable)
      .set({ title: "Edited task" })
      .where(eq(schema.taskTable.id, context.task.id));
    await db
      .update(schema.workflowRuleTable)
      .set({ columnId: done!.id })
      .where(eq(schema.workflowRuleTable.projectId, context.project.id));
    expect(
      (await deliver(app, context.integration.id, JSON.stringify(payload())))
        .status,
    ).toBe(200);
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, context.task.id),
      }),
    ).toMatchObject({ status: "done", title: "Edited task" });
  });

  it("exposes the inbound provider with configuration validation", async () => {
    const plugin = integrationPlugins.find(
      (candidate) => candidate.type === "tangled",
    );
    expect(plugin).toBeDefined();
    await expect(plugin!.validateConfig!(config)).resolves.toMatchObject({
      valid: true,
    });
    await expect(plugin!.validateConfig!({})).resolves.toMatchObject({
      valid: false,
    });
  });

  it("serializes concurrent retries into one link", async () => {
    const context = await fixture();
    const { app } = createApp();
    const body = JSON.stringify(payload());
    const responses = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        deliver(app, context.integration.id, body, "push", {
          "x-tangled-delivery": String(i),
        }),
      ),
    );
    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200, 200,
    ]);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(1);
  });

  it("rolls back the branch link when its durable outcome cannot be committed", async () => {
    const context = await fixture();
    vi.spyOn(outcomes, "recordTangledOutcome").mockRejectedValue(
      new Error("database unavailable"),
    );
    const published = vi.spyOn(events, "publishEvent").mockResolvedValue();
    const { app } = createApp();
    const response = await deliver(
      app,
      context.integration.id,
      JSON.stringify(payload()),
    );
    expect(response.status).toBe(503);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
    expect(published).not.toHaveBeenCalled();
  });

  it("logs a safe category when webhook persistence fails", async () => {
    const context = await fixture();
    const privateError = Object.assign(new Error("private webhook secret"), {
      code: "23505",
    });
    vi.spyOn(outcomes, "recordTangledOutcome").mockRejectedValue(privateError);
    const logs = vi.spyOn(console, "error").mockImplementation(() => {});
    const { app } = createApp();

    const response = await deliver(
      app,
      context.integration.id,
      JSON.stringify(payload()),
    );

    expect(response.status).toBe(503);
    expect(logs).toHaveBeenCalledWith("Tangled processing failed", {
      stage: "webhook",
      category: "database_constraint",
    });
    expect(JSON.stringify(logs.mock.calls)).not.toContain(
      "private webhook secret",
    );
  });

  it("rejects malformed branch refs as bad requests rather than retryable failures", async () => {
    const context = await fixture();
    const { app } = createApp();
    for (const ref of ["refs/heads/KAN-12\\n", "refs/heads/KAN-12\n"]) {
      expect(
        (
          await deliver(
            app,
            context.integration.id,
            JSON.stringify(payload(ref)),
          )
        ).status,
      ).toBe(400);
    }
  });
  it("accepts signed anonymous delivery and links only the matching project task using the current head", async () => {
    const context = await fixture();
    const other = await createProjectFixture({
      workspaceId: context.workspace.id,
      slug: "OTHER",
    });
    await db.insert(schema.taskTable).values({
      projectId: other.project.id,
      number: 12,
      title: "Other project task",
    });
    const published: unknown[] = [];
    vi.spyOn(events, "publishEvent").mockImplementation(async (type, data) => {
      if (type === "task.updated")
        published.push({
          data,
          committedLinks: (await db.query.externalLinkTable.findMany()).length,
        });
    });
    const { app } = createApp();
    const body = JSON.stringify(payload(), null, 2);
    expect((await deliver(app, context.integration.id, body)).status).toBe(200);
    expect(
      (
        await deliver(app, context.integration.id, body, "push", {
          "x-tangled-delivery": "different-retry-id",
        })
      ).status,
    ).toBe(200);
    const links = await db.query.externalLinkTable.findMany();
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      taskId: context.task.id,
      integrationId: context.integration.id,
      externalId: "KAN-12",
      resourceType: "branch",
      url: "https://tangled.example/owner/repo/tree/KAN-12",
    });
    expect(JSON.parse(links[0]!.metadata!)).toMatchObject({
      lastCommit: { sha: "b".repeat(40) },
    });
    expect(published).toEqual([
      {
        data: { projectId: context.project.id, taskId: context.task.id },
        committedLinks: 1,
      },
    ]);
    expect(
      await db.query.taskTable.findFirst({
        where: (task, { eq }) => eq(task.id, context.task.id),
      }),
    ).toMatchObject({ status: "done" });
  });

  it("acknowledges a delayed push when its branch no longer exists", async () => {
    const context = await fixture();
    const { app } = createApp();
    const body = JSON.stringify(payload());
    expect((await deliver(app, context.integration.id, body)).status).toBe(200);
    upstream.missing = true;

    const response = await deliver(app, context.integration.id, body);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "skipped" });
    expect(await db.query.externalLinkTable.findMany()).toMatchObject([
      { taskId: context.task.id, externalId: "KAN-12" },
    ]);
    expect(await db.query.taskTable.findFirst()).toMatchObject({
      status: "done",
    });
    expect(
      await db.query.tangledIntegrationStateTable.findFirst(),
    ).toMatchObject({
      eventType: "push",
      outcome: "skipped",
      code: "branch_missing",
    });
  });

  it("does not update a branch link already attached to a different task", async () => {
    const context = await fixture();
    const [other] = await db
      .insert(schema.taskTable)
      .values({
        projectId: context.project.id,
        number: 13,
        title: "Different task",
      })
      .returning();
    const [link] = await db
      .insert(schema.externalLinkTable)
      .values({
        integrationId: context.integration.id,
        taskId: other!.id,
        resourceType: "branch",
        externalId: "KAN-12",
        url: "https://tangled.example/existing",
        title: "Existing link",
      })
      .returning();
    const { app } = createApp();
    const response = await deliver(
      app,
      context.integration.id,
      JSON.stringify(payload()),
    );
    expect(response.status).toBe(200);
    expect(await db.query.externalLinkTable.findMany()).toMatchObject([
      { id: link!.id, taskId: other!.id, title: "Existing link" },
    ]);
    mockAuthenticatedSession(context.user);
    const outcome = await app.request(
      `/api/tangled-integration/project/${context.project.id}/outcome`,
    );
    expect(await outcome.json()).toMatchObject({
      outcome: "skipped",
      code: "branch_conflict",
    });
  });

  it("rejects invalid signatures before parsing or contacting Tangled", async () => {
    const { integration } = await fixture();
    const { app } = createApp();
    const response = await deliver(
      app,
      integration.id,
      "malformed JSON",
      "push",
      { "x-tangled-signature-256": "invalid" },
    );
    expect(response.status).toBe(401);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
  });

  it("rejects a signed payload for another repository and conflicting unsigned repository headers", async () => {
    const { integration } = await fixture();
    const { app } = createApp();
    const wrongRepo = {
      ...payload(),
      repository: { full_name: "did:plc:other/repo" },
    };
    expect(
      (await deliver(app, integration.id, JSON.stringify(wrongRepo))).status,
    ).toBe(403);
    expect(
      (
        await deliver(app, integration.id, JSON.stringify(payload()), "push", {
          "x-tangled-repo": "did:plc:other/repo",
        })
      ).status,
    ).toBe(400);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
  });

  it("rejects oversized bodies despite a misleading Content-Length", async () => {
    const { integration } = await fixture();
    const { app } = createApp();
    const response = await deliver(
      app,
      integration.id,
      "x".repeat(1_048_577),
      "push",
      { "content-length": "1" },
    );
    expect(response.status).toBe(413);
  });

  it("rejects malformed JSON and unsupported events", async () => {
    const { integration } = await fixture();
    const { app } = createApp();
    expect((await deliver(app, integration.id, "malformed JSON")).status).toBe(
      400,
    );
    expect(
      (await deliver(app, integration.id, JSON.stringify(payload()), "unknown"))
        .status,
    ).toBe(400);
  });

  it("returns retryable failures without changing links and exposes only sanitized outcomes to managers", async () => {
    const context = await fixture();
    upstream.available = false;
    const logs = vi.spyOn(console, "error").mockImplementation(() => {});
    const { app } = createApp();
    const response = await deliver(
      app,
      context.integration.id,
      JSON.stringify(payload()),
    );
    expect(response.status).toBe(503);
    expect(logs).toHaveBeenCalledWith("Tangled processing failed", {
      stage: "repository_lookup",
      category: "unexpected",
    });
    expect(JSON.stringify(logs.mock.calls)).not.toContain(
      "private-upstream-error",
    );
    expect(await response.text()).not.toContain("private-upstream-error");
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
    mockAuthenticatedSession(context.user);
    const status = await app.request(
      `/api/tangled-integration/project/${context.project.id}/outcome`,
    );
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({
      outcome: "failed",
      code: "upstream_failed",
    });
    upstream.available = true;
    expect(
      (await deliver(app, context.integration.id, JSON.stringify(payload())))
        .status,
    ).toBe(200);
  });

  it("durably reports PR events as skipped, without inferring PR identity", async () => {
    const context = await fixture();
    const { app } = createApp();
    const body = JSON.stringify({
      action: "merged",
      pull_request: { number: 0 },
      repository: { full_name: config.repositoryFullName },
    });
    const response = await deliver(
      app,
      context.integration.id,
      body,
      "pull_request:merged",
    );
    expect(response.status).toBe(200);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
    mockAuthenticatedSession(context.user);
    const status = await app.request(
      `/api/tangled-integration/project/${context.project.id}/outcome`,
    );
    const result = await status.json();
    expect(result).toMatchObject({
      eventType: "pull_request",
      outcome: "skipped",
      code: "pull_request_unsupported",
    });
    expect(JSON.stringify(result)).not.toContain(config.webhookSecret);
    const outsider = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(outsider.user);
    expect(
      (
        await app.request(
          `/api/tangled-integration/project/${context.project.id}/outcome`,
        )
      ).status,
    ).toBe(404);
  });

  it("rejects an old configuration snapshot after a connection is changed", async () => {
    const context = await fixture();
    const old = await loadTangledConnection(context.integration.id);
    await db.update(schema.integrationTable).set({
      config: JSON.stringify({ ...config, webhookSecret: "rotated-secret" }),
    });
    await expect(
      reconcileTangledBranch(old, "refs/heads/KAN-12"),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
  });

  it("honors instance-wide provider disabling", async () => {
    const context = await fixture();
    await db
      .insert(schema.instanceSettingsTable)
      .values({ disabledIntegrations: ["tangled"] });
    const { app } = createApp();
    expect(
      (await deliver(app, context.integration.id, JSON.stringify(payload())))
        .status,
    ).toBe(404);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
  });

  it("does not deliver into an archived workspace", async () => {
    const context = await fixture();
    await db.update(schema.workspaceTable).set({ archivedAt: new Date() });
    const { app } = createApp();
    expect(
      (await deliver(app, context.integration.id, JSON.stringify(payload())))
        .status,
    ).toBe(404);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
  });

  it("does not expose processing outcomes to ordinary workspace members", async () => {
    const context = await fixture();
    const reader = await createWorkspaceMember({ role: "member" });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: context.workspace.id,
      userId: reader.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    mockAuthenticatedSession(reader.user);
    const { app } = createApp();
    expect(
      (
        await app.request(
          `/api/tangled-integration/project/${context.project.id}/outcome`,
        )
      ).status,
    ).toBe(403);
  });

  it("does not process deliveries for disabled or unknown connections", async () => {
    const context = await fixture();
    await db.update(schema.integrationTable).set({ isActive: false });
    const { app } = createApp();
    expect(
      (await deliver(app, context.integration.id, JSON.stringify(payload())))
        .status,
    ).toBe(404);
    expect(
      (await deliver(app, "missing", JSON.stringify(payload()))).status,
    ).toBe(404);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
  });
});

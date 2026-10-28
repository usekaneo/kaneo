import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { createProposal } from "../../apps/api/src/agent/controllers/create-proposal";
import { deliverAgentEffects } from "../../apps/api/src/agent/effects";
import { publishEvent } from "../../apps/api/src/events";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import type { AgentAction } from "../../apps/api/src/agent/types";

vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<object>()),
  publishEvent: vi.fn(async () => undefined),
}));
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  vi.stubEnv("KANEO_AGENT_ENABLED", "true");
  vi.stubEnv("OPENROUTER_API_KEY", "fake-test-key");
  vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-6-luna");
});
afterEach(() => vi.unstubAllEnvs());

async function setup(role = "admin") {
  const { user, workspace } = await createWorkspaceMember({ role });
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.todo.id,
      title: "Fix reconnect",
      number: 1,
      priority: "low",
      status: "to-do",
    })
    .returning();
  await db
    .update(schema.projectTable)
    .set({ lastTaskNumber: 1 })
    .where(eq(schema.projectTable.id, project.id));
  mockAuthenticatedSession(user);
  const { app } = createApp();
  const base = `/api/agent/${workspace.id}`;
  const post = (path: string, body?: unknown) =>
    app.request(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const response = await post("/conversations", { projectId: project.id });
  expect(response.status).toBe(201);
  const conversation = await response.json();
  const created = await post(`/conversations/${conversation.id}/runs`, {
    requestId: randomUUID(),
    prompt: "Help plan the week",
  });
  expect(created.status).toBe(202);
  const run = await created.json();
  const owner = randomUUID();
  await db
    .update(schema.agentRunTable)
    .set({
      status: "running",
      leaseOwner: owner,
      leaseExpiresAt: new Date(Date.now() + 60000),
    })
    .where(eq(schema.agentRunTable.id, run.id));
  const subject = {
    userId: user.id,
    workspaceId: workspace.id,
    projectId: project.id,
  };
  const propose = async (action: AgentAction) =>
    createProposal(
      subject,
      run.id,
      { action, reason: "Improve the plan" },
      owner,
    );
  const ready = async () =>
    db
      .update(schema.agentRunTable)
      .set({ status: "awaiting_review", finishedAt: new Date() })
      .where(eq(schema.agentRunTable.id, run.id));
  const apply = (ids: string[]) =>
    post(`/runs/${run.id}/apply`, { proposalIds: ids });
  return {
    app,
    base,
    post,
    user,
    workspace,
    project,
    task,
    conversation,
    run,
    subject,
    propose,
    ready,
    apply,
  };
}

describe("private agent API", () => {
  it("requires authentication and returns no API key in configuration", async () => {
    const ctx = await setup();
    const config = await ctx.app.request(`${ctx.base}/config`);
    expect(await config.json()).toMatchObject({
      enabled: true,
      model: "openai/gpt-6-luna",
    });
    expect(
      await (await ctx.app.request(`${ctx.base}/config`)).text(),
    ).not.toContain("fake-test-key");
    mockAnonymousSession();
    expect((await ctx.app.request(`${ctx.base}/config`)).status).toBe(401);
  });
  it("keeps conversations and runs private even from other workspace admins", async () => {
    const ctx = await setup();
    const other = await createWorkspaceMember({ role: "admin" });
    await db.insert(schema.workspaceUserTable).values({
      userId: other.user.id,
      workspaceId: ctx.workspace.id,
      role: "admin",
      joinedAt: new Date(),
    });
    mockAuthenticatedSession(other.user);
    expect(
      await (await ctx.app.request(`${ctx.base}/conversations`)).json(),
    ).toEqual([]);
    expect(
      (await ctx.app.request(`${ctx.base}/runs/${ctx.run.id}`)).status,
    ).toBe(404);
    expect((await ctx.post(`/runs/${ctx.run.id}/cancel`)).status).toBe(404);
  });
  it("lists recent runs with proposal counts and filters conversations by project", async () => {
    const ctx = await setup();
    await ctx.propose({
      type: "task.update",
      taskId: ctx.task.id,
      patch: { priority: "high" },
    });
    const workspaceWide = await (
      await ctx.post("/conversations", { title: "Across projects" })
    ).json();
    const recent = await (
      await ctx.app.request(`${ctx.base}/runs?limit=5`)
    ).json();
    expect(recent).toEqual([
      expect.objectContaining({
        id: ctx.run.id,
        conversationId: ctx.conversation.id,
        projectId: ctx.project.id,
        prompt: "Help plan the week",
        pendingProposals: 1,
        appliedProposals: 0,
      }),
    ]);
    const scoped = await (
      await ctx.app.request(
        `${ctx.base}/conversations?projectId=${ctx.project.id}`,
      )
    ).json();
    expect(scoped.map((item: { id: string }) => item.id)).toEqual([
      ctx.conversation.id,
    ]);
    const all = await (
      await ctx.app.request(`${ctx.base}/conversations`)
    ).json();
    expect(all.map((item: { id: string }) => item.id)).toContain(
      workspaceWide.id,
    );
    const other = await createWorkspaceMember({ role: "admin" });
    await db.insert(schema.workspaceUserTable).values({
      userId: other.user.id,
      workspaceId: ctx.workspace.id,
      role: "admin",
      joinedAt: new Date(),
    });
    mockAuthenticatedSession(other.user);
    expect(await (await ctx.app.request(`${ctx.base}/runs`)).json()).toEqual(
      [],
    );
  });
  it("does not allow a foreign project or task to escape the run's scope", async () => {
    const ctx = await setup();
    const other = await createWorkspaceMember();
    const foreign = await createProjectFixture({
      workspaceId: other.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({ projectId: foreign.project.id, title: "Secret task" })
      .returning();
    expect(
      (await ctx.post("/conversations", { projectId: foreign.project.id }))
        .status,
    ).toBe(404);
    await expect(
      ctx.propose({
        type: "task.update",
        taskId: task.id,
        patch: { priority: "high" },
      }),
    ).rejects.toMatchObject({ status: 404 });
    const another = await createProjectFixture({
      workspaceId: ctx.workspace.id,
    });
    const [outsideProject] = await db
      .insert(schema.taskTable)
      .values({ projectId: another.project.id, title: "Another project" })
      .returning();
    await expect(
      ctx.propose({
        type: "task.update",
        taskId: outsideProject.id,
        patch: { title: "Oops" },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("is explicitly disabled when the instance setting is off", async () => {
    const ctx = await setup();
    vi.stubEnv("KANEO_AGENT_ENABLED", "false");
    expect((await ctx.post("/conversations", {})).status).toBe(503);
    expect(
      await (await ctx.app.request(`${ctx.base}/config`)).json(),
    ).toMatchObject({ enabled: false, model: null, models: [] });
  });
  it("runs only allowed models and stores the chosen one", async () => {
    vi.stubEnv("OPENROUTER_MODELS", "anthropic/claude-opus-5");
    const ctx = await setup();
    expect(
      await (await ctx.app.request(`${ctx.base}/config`)).json(),
    ).toMatchObject({
      model: "openai/gpt-6-luna",
      models: [
        { id: "openai/gpt-6-luna", label: "OpenAI: GPT-6 Luna" },
        { id: "anthropic/claude-opus-5", label: "Anthropic: Claude Opus 5" },
      ],
    });
    await ctx.post(`/runs/${ctx.run.id}/cancel`);
    const path = `/conversations/${ctx.conversation.id}/runs`;
    expect(
      (
        await ctx.post(path, {
          requestId: randomUUID(),
          prompt: "Plan",
          model: "openai/gpt-6-ultra",
        })
      ).status,
    ).toBe(400);
    const request = {
      requestId: randomUUID(),
      prompt: "Plan",
      model: "anthropic/claude-opus-5",
    };
    const created = await ctx.post(path, request);
    expect(created.status).toBe(202);
    const { id } = await created.json();
    expect((await (await ctx.post(path, request)).json()).id).toBe(id);
    expect(
      (await ctx.post(path, { ...request, model: undefined })).status,
    ).toBe(409);
    expect(
      (await (await ctx.app.request(`${ctx.base}/runs/${id}`)).json()).model,
    ).toBe("anthropic/claude-opus-5");
    expect(
      (
        await db.query.agentRunTable.findFirst({
          where: eq(schema.agentRunTable.id, ctx.run.id),
        })
      )?.model,
    ).toBe("openai/gpt-6-luna");
  });
  it("deduplicates run requests and rejects changed prompts or concurrent conversation turns", async () => {
    const ctx = await setup();
    const requestId = randomUUID();
    await ctx.post(`/runs/${ctx.run.id}/cancel`);
    const path = `/conversations/${ctx.conversation.id}/runs`;
    const first = await (
      await ctx.post(path, { requestId, prompt: "Summarize" })
    ).json();
    expect(
      await (await ctx.post(path, { requestId, prompt: "Summarize" })).json(),
    ).toEqual(first);
    expect(
      (await ctx.post(path, { requestId, prompt: "Different" })).status,
    ).toBe(409);
    expect(
      (await ctx.post(path, { requestId: randomUUID(), prompt: "Another" }))
        .status,
    ).toBe(409);
  });
  it("stores attached text files but only returns their names and sizes", async () => {
    const ctx = await setup();
    await ctx.post(`/runs/${ctx.run.id}/cancel`);
    const path = `/conversations/${ctx.conversation.id}/runs`;
    const requestId = randomUUID();
    const attachments = [{ name: "notes.md", content: "Ship the guide" }];
    const created = await ctx.post(path, {
      requestId,
      prompt: "Make tasks",
      attachments,
    });
    expect(created.status).toBe(202);
    const { id } = await created.json();
    const details = await (
      await ctx.app.request(`${ctx.base}/runs/${id}`)
    ).text();
    expect(JSON.parse(details).attachments).toEqual([
      { type: "text", name: "notes.md", size: 14 },
    ]);
    expect(details).not.toContain("Ship the guide");
    const listed = await (await ctx.app.request(`${ctx.base}${path}`)).text();
    expect(listed).not.toContain("Ship the guide");
    expect(
      (
        await db.query.agentRunTable.findFirst({
          where: eq(schema.agentRunTable.id, id),
        })
      )?.attachments,
    ).toEqual(attachments);
    expect(
      (
        await ctx.post(path, {
          requestId,
          prompt: "Make tasks",
          attachments: [{ name: "notes.md", content: "Changed" }],
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await ctx.post(path, {
          requestId: randomUUID(),
          prompt: "Too many",
          attachments: Array.from({ length: 6 }, (_, index) => ({
            name: `${index}.md`,
            content: "x",
          })),
        })
      ).status,
    ).toBe(400);
  });
});

describe("reviewed mutations", () => {
  it("saves proposals without writes, applies once under concurrent retries, and emits domain events", async () => {
    const ctx = await setup();
    const proposal = await ctx.propose({
      type: "task.update",
      taskId: ctx.task.id,
      patch: {
        title: "Fix proxy reconnect",
        priority: "high",
        dueDate: "2026-10-08T00:00:00Z",
      },
    });
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, ctx.task.id),
        })
      )?.title,
    ).toBe("Fix reconnect");
    await ctx.ready();
    const replies = await Promise.all([
      ctx.apply([proposal.id]),
      ctx.apply([proposal.id]),
    ]);
    for (const reply of replies)
      expect(await reply.json()).toMatchObject({
        results: [{ id: proposal.id, status: "applied" }],
      });
    expect(await db.select().from(schema.agentEffectTable)).toHaveLength(1);
    await deliverAgentEffects();
    await deliverAgentEffects();
    const events = vi.mocked(publishEvent).mock.calls;
    expect(
      events.filter(([name]) => name === "task.title_changed"),
    ).toHaveLength(1);
    expect(publishEvent).toHaveBeenCalledWith(
      "task.priority_changed",
      expect.objectContaining({
        taskId: ctx.task.id,
        userId: ctx.user.id,
        oldPriority: "low",
        newPriority: "high",
      }),
    );
    expect(publishEvent).toHaveBeenCalledWith(
      "task.updated",
      expect.objectContaining({
        taskId: ctx.task.id,
        projectId: ctx.project.id,
        userId: ctx.user.id,
      }),
    );
  });
  it("checks affected fields while preserving unrelated concurrent changes", async () => {
    const ctx = await setup();
    const proposal = await ctx.propose({
      type: "task.update",
      taskId: ctx.task.id,
      patch: { priority: "high" },
    });
    await db
      .update(schema.taskTable)
      .set({ title: "Changed by teammate" })
      .where(eq(schema.taskTable.id, ctx.task.id));
    await ctx.ready();
    expect(await (await ctx.apply([proposal.id])).json()).toMatchObject({
      results: [{ status: "applied" }],
    });
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, ctx.task.id),
      }),
    ).toMatchObject({ title: "Changed by teammate", priority: "high" });
    expect((await ctx.post(`/proposals/${proposal.id}/undo`)).status).toBe(200);
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, ctx.task.id),
      }),
    ).toMatchObject({ title: "Changed by teammate", priority: "low" });
    expect((await ctx.post(`/proposals/${proposal.id}/undo`)).status).toBe(200);
  });
  it("returns a conflict instead of overwriting a newer change, and prevents unsafe undo", async () => {
    const ctx = await setup();
    const proposal = await ctx.propose({
      type: "task.update",
      taskId: ctx.task.id,
      patch: { priority: "high" },
    });
    await ctx.ready();
    await db
      .update(schema.taskTable)
      .set({ priority: "urgent" })
      .where(eq(schema.taskTable.id, ctx.task.id));
    expect(await (await ctx.apply([proposal.id])).json()).toMatchObject({
      results: [{ status: "failed", code: 409 }],
    });
    await db
      .update(schema.taskTable)
      .set({ priority: "low" })
      .where(eq(schema.taskTable.id, ctx.task.id));
    await ctx.apply([proposal.id]);
    await db
      .update(schema.taskTable)
      .set({ priority: "medium" })
      .where(eq(schema.taskTable.id, ctx.task.id));
    expect((await ctx.post(`/proposals/${proposal.id}/undo`)).status).toBe(409);
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, ctx.task.id),
      }),
    ).toMatchObject({ priority: "medium" });
  });
  it("rechecks demoted roles and member assignment permissions", async () => {
    const ctx = await setup();
    const proposal = await ctx.propose({
      type: "task.update",
      taskId: ctx.task.id,
      patch: { priority: "high" },
    });
    await ctx.ready();
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "viewer" })
      .where(
        and(
          eq(schema.workspaceUserTable.userId, ctx.user.id),
          eq(schema.workspaceUserTable.workspaceId, ctx.workspace.id),
        ),
      );
    expect(await (await ctx.apply([proposal.id])).json()).toMatchObject({
      results: [{ status: "failed", code: 403 }],
    });
    expect((await ctx.post(`/proposals/${proposal.id}/undo`)).status).toBe(403);
  });
  it("creates tasks using normal numbering and columns and never duplicates on retries", async () => {
    const ctx = await setup();
    const proposal = await ctx.propose({
      type: "task.create",
      projectId: ctx.project.id,
      title: "Write migration guide",
      description: "From planning notes",
      status: "to-do",
      priority: "medium",
      userId: null,
      dueDate: null,
    });
    await ctx.ready();
    await Promise.all([ctx.apply([proposal.id]), ctx.apply([proposal.id])]);
    const tasks = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, ctx.project.id));
    expect(tasks).toHaveLength(2);
    expect(
      tasks.find((task) => task.title === "Write migration guide"),
    ).toMatchObject({
      number: 2,
      description: "From planning notes",
      status: "to-do",
    });
    await deliverAgentEffects();
    expect(publishEvent).toHaveBeenCalledWith(
      "task.created",
      expect.objectContaining({
        title: "Write migration guide",
        currentUserId: ctx.user.id,
      }),
    );
    expect((await ctx.post(`/proposals/${proposal.id}/undo`)).status).toBe(400);
  });
  it("does not deliver undo before a leased apply effect", async () => {
    const ctx = await setup();
    const proposal = await ctx.propose({
      type: "task.update",
      taskId: ctx.task.id,
      patch: { priority: "high" },
    });
    await ctx.ready();
    await ctx.apply([proposal.id]);
    const [effect] = await db.select().from(schema.agentEffectTable);
    await ctx.post(`/proposals/${proposal.id}/undo`);
    await db
      .update(schema.agentEffectTable)
      .set({
        leaseOwner: "other-worker",
        leaseExpiresAt: new Date(Date.now() + 60000),
      })
      .where(eq(schema.agentEffectTable.id, effect.id));
    await deliverAgentEffects();
    expect(publishEvent).not.toHaveBeenCalled();
    await db
      .update(schema.agentEffectTable)
      .set({ leaseExpiresAt: new Date(0) })
      .where(eq(schema.agentEffectTable.id, effect.id));
    await deliverAgentEffects();
    expect(
      vi
        .mocked(publishEvent)
        .mock.calls.filter(([name]) => name === "task.priority_changed")
        .map(([, data]) => (data as { newPriority: string }).newPriority),
    ).toEqual(["high", "low"]);
  });
  it("requires assign permission independently of task update permission", async () => {
    const ctx = await setup("member");
    await expect(
      ctx.propose({
        type: "task.update",
        taskId: ctx.task.id,
        patch: { userId: ctx.user.id },
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      ctx.propose({
        type: "task.update",
        taskId: ctx.task.id,
        patch: { userId: null, priority: "high" },
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      ctx.propose({
        type: "task.update",
        taskId: ctx.task.id,
        patch: { priority: "high" },
      }),
    ).resolves.toMatchObject({ status: "pending" });
  });
  it("discards only selected proposals and refuses to apply discarded changes", async () => {
    const ctx = await setup();
    const a = await ctx.propose({
      type: "task.update",
      taskId: ctx.task.id,
      patch: { priority: "high" },
    });
    const b = await ctx.propose({
      type: "task.update",
      taskId: ctx.task.id,
      patch: { title: "New title" },
    });
    await ctx.ready();
    expect(
      (await ctx.post(`/runs/${ctx.run.id}/discard`, { proposalIds: [a.id] }))
        .status,
    ).toBe(200);
    expect(await (await ctx.apply([a.id, b.id])).json()).toMatchObject({
      results: [
        { id: a.id, status: "failed", code: 409 },
        { id: b.id, status: "applied" },
      ],
    });
    expect(
      (
        await ctx.post(`/runs/${ctx.run.id}/apply`, {
          proposalIds: [b.id, b.id],
        })
      ).status,
    ).toBe(400);
  });
  it("prevents proposals and pending writes after cancellation", async () => {
    const ctx = await setup();
    const a = await ctx.propose({
      type: "task.update",
      taskId: ctx.task.id,
      patch: { priority: "high" },
    });
    expect((await ctx.post(`/runs/${ctx.run.id}/cancel`)).status).toBe(200);
    await expect(
      ctx.propose({
        type: "task.update",
        taskId: ctx.task.id,
        patch: { title: "Late" },
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await (await ctx.apply([a.id])).json()).toMatchObject({
      results: [{ status: "failed", code: 409 }],
    });
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, ctx.task.id),
      }),
    ).toMatchObject({ priority: "low" });
  });
});

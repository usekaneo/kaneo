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
import updateComment from "../../apps/api/src/activity/controllers/update-comment";
import { createProposal } from "../../apps/api/src/agent/controllers/create-proposal";
import { deliverAgentEffects } from "../../apps/api/src/agent/effects";
import db, { schema } from "../../apps/api/src/database";
import { publishEvent } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

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

// Conversations are workspace-scoped so project access can be revoked
// without hiding the run itself.
async function setup() {
  const { user, workspace } = await createWorkspaceMember({
    role: "admin",
    userName: "Alex",
  });
  const { user: jordan } = await createWorkspaceMember({ userName: "Jordan" });
  const { user: mira } = await createWorkspaceMember({ userName: "Mira" });
  for (const member of [jordan, mira])
    await db.insert(schema.workspaceUserTable).values({
      userId: member.id,
      workspaceId: workspace.id,
      role: "member",
      joinedAt: new Date(),
    });
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.todo.id,
      title: "Fix proxy reconnect",
      number: 1,
      status: "to-do",
      userId: mira.id,
    })
    .returning();
  mockAuthenticatedSession(user);
  const { app } = createApp();
  const base = `/api/agent/${workspace.id}`;
  const post = (path: string, body?: unknown) =>
    app.request(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const conversation = await (await post("/conversations", {})).json();
  const run = await (
    await post(`/conversations/${conversation.id}/runs`, {
      requestId: randomUUID(),
      prompt: "Nudge Jordan about the review",
    })
  ).json();
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
    projectId: null,
  };
  const body = `<kaneo-mention id="${jordan.id}" label="Jordan"></kaneo-mention> could you review #1862 today?`;
  const propose = (taskId = task.id) =>
    createProposal(
      subject,
      run.id,
      { action: { type: "comment.create", taskId, body }, reason: "Unblock" },
      owner,
    );
  const ready = () =>
    db
      .update(schema.agentRunTable)
      .set({ status: "awaiting_review", finishedAt: new Date() })
      .where(eq(schema.agentRunTable.id, run.id));
  const resume = () =>
    db
      .update(schema.agentRunTable)
      .set({ status: "running" })
      .where(eq(schema.agentRunTable.id, run.id));
  const apply = async (id: string) =>
    (await post(`/runs/${run.id}/apply`, { proposalIds: [id] })).json();
  const comments = () =>
    db
      .select()
      .from(schema.activityTable)
      .where(
        and(
          eq(schema.activityTable.taskId, task.id),
          eq(schema.activityTable.type, "comment"),
        ),
      );
  const events = (name: string) =>
    vi.mocked(publishEvent).mock.calls.filter(([event]) => event === name);
  return {
    app,
    base,
    post,
    user,
    jordan,
    mira,
    workspace,
    project,
    task,
    run,
    body,
    propose,
    ready,
    resume,
    apply,
    comments,
    events,
  };
}

describe("agent comment proposals", () => {
  it("posts exactly one comment as the applying user, even under concurrent retries", async () => {
    const ctx = await setup();
    const proposal = await ctx.propose();
    expect(proposal).toMatchObject({
      status: "pending",
      before: { id: ctx.task.id, title: "Fix proxy reconnect" },
    });
    expect(await ctx.comments()).toHaveLength(0);
    await ctx.ready();

    const replies = await Promise.all([
      ctx.apply(proposal.id),
      ctx.apply(proposal.id),
    ]);
    for (const reply of replies)
      expect(reply).toMatchObject({
        results: [{ id: proposal.id, status: "applied" }],
      });

    const [comment, ...extra] = await ctx.comments();
    expect(extra).toHaveLength(0);
    expect(comment).toMatchObject({ userId: ctx.user.id, content: ctx.body });
    const notifications = await db.select().from(schema.notificationTable);
    expect(notifications.map(({ userId, type }) => ({ userId, type }))).toEqual(
      expect.arrayContaining([
        { userId: ctx.jordan.id, type: "task_mention" },
        { userId: ctx.mira.id, type: "task_comment" },
      ]),
    );
    expect(notifications).toHaveLength(2);
    expect(await db.select().from(schema.agentEffectTable)).toHaveLength(1);

    const run = await (
      await ctx.app.request(`${ctx.base}/runs/${ctx.run.id}`)
    ).json();
    expect(run.status).toBe("completed");
    expect(run.proposals[0]).toMatchObject({
      status: "applied",
      after: { id: ctx.task.id, commentId: comment?.id },
    });

    // Nothing is published until the outbox runs after commit.
    expect(publishEvent).not.toHaveBeenCalled();
    await deliverAgentEffects();
    await deliverAgentEffects();
    expect(ctx.events("comment.created")).toEqual([
      [
        "comment.created",
        expect.objectContaining({
          id: comment?.id,
          taskId: ctx.task.id,
          userId: ctx.user.id,
          projectId: ctx.project.id,
          createdAt: expect.any(Date),
          comment: `**Alex** commented:\n> ${ctx.body}`,
        }),
      ],
    ]);
    expect(
      ctx
        .events("notification.created")
        .map(([, data]) => (data as { userId: string }).userId)
        .sort(),
    ).toEqual([ctx.jordan.id, ctx.mira.id].sort());
  });

  it("fails without a comment when the user loses task update permission", async () => {
    const ctx = await setup();
    const proposal = await ctx.propose();
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
    expect(await ctx.apply(proposal.id)).toMatchObject({
      results: [{ status: "failed", code: 403 }],
    });
    expect(await ctx.comments()).toHaveLength(0);
    await ctx.resume();
    await expect(ctx.propose()).rejects.toMatchObject({ status: 403 });
  });

  it("refuses tasks in projects the user can no longer access", async () => {
    const ctx = await setup();
    const proposal = await ctx.propose();
    await ctx.ready();
    await db.insert(schema.workspaceMemberAccessTable).values({
      workspaceId: ctx.workspace.id,
      userId: ctx.user.id,
      projectAccess: "selected",
    });
    expect(await ctx.apply(proposal.id)).toMatchObject({
      results: [{ status: "failed", code: 404 }],
    });
    expect(await ctx.comments()).toHaveLength(0);
    await ctx.resume();
    await expect(ctx.propose()).rejects.toMatchObject({ status: 404 });
  });

  it("undoes an unedited comment through the normal delete events", async () => {
    const ctx = await setup();
    const proposal = await ctx.propose();
    await ctx.ready();
    await ctx.apply(proposal.id);
    const [comment] = await ctx.comments();

    expect((await ctx.post(`/proposals/${proposal.id}/undo`)).status).toBe(200);
    expect(await ctx.comments()).toHaveLength(0);
    expect((await ctx.post(`/proposals/${proposal.id}/undo`)).status).toBe(200);

    await deliverAgentEffects();
    expect(ctx.events("comment.created")).toHaveLength(1);
    expect(ctx.events("comment.deleted")).toEqual([
      [
        "comment.deleted",
        expect.objectContaining({
          id: comment?.id,
          projectId: ctx.project.id,
          userId: ctx.user.id,
        }),
      ],
    ]);
    const calls = vi.mocked(publishEvent).mock.calls.map(([name]) => name);
    expect(calls.indexOf("comment.created")).toBeLessThan(
      calls.indexOf("comment.deleted"),
    );
  });

  it("keeps an edited or removed comment and reports a conflict", async () => {
    const ctx = await setup();
    const proposal = await ctx.propose();
    await ctx.ready();
    await ctx.apply(proposal.id);
    const [comment] = await ctx.comments();
    if (!comment) throw new Error("Expected a posted comment");

    await updateComment(ctx.user.id, comment.id, ctx.body);
    expect((await ctx.post(`/proposals/${proposal.id}/undo`)).status).toBe(409);
    expect(await ctx.comments()).toHaveLength(1);

    await db
      .delete(schema.activityTable)
      .where(eq(schema.activityTable.id, comment.id));
    expect((await ctx.post(`/proposals/${proposal.id}/undo`)).status).toBe(409);
    expect(
      (
        await db.query.agentProposalTable.findFirst({
          where: eq(schema.agentProposalTable.id, proposal.id),
        })
      )?.status,
    ).toBe("applied");
  });
});

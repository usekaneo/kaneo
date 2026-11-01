import { randomUUID } from "node:crypto";
import { MockLanguageModelV4 } from "ai/test";
import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import {
  executeAgentRun,
  failExpiredRuns,
} from "../../apps/api/src/agent/runner";
import { requireAgentConfig } from "../../apps/api/src/agent/config";
import { createAgentTools } from "../../apps/api/src/agent/tools";
import { assertAgentAccess } from "../../apps/api/src/agent/access";
import {
  readProjects,
  readTask,
  readTasks,
  readWorkload,
} from "../../apps/api/src/agent/tools/read-tools";
import { validateAction } from "../../apps/api/src/agent/validate-action";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { createRestrictedWorkspace } from "./helpers/project-access/create-restricted-workspace";

beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("KANEO_AGENT_ENABLED", "true");
  vi.stubEnv("OPENROUTER_API_KEY", "fake-key");
  vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-6-luna");
});
afterEach(() => vi.unstubAllEnvs());

async function setup() {
  const { user, workspace } = await createWorkspaceMember({ role: "admin" });
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.todo.id,
      title: "Fix proxy bug",
      description: "x".repeat(20000),
      status: "to-do",
      priority: "low",
      dueDate: new Date("2026-10-01T00:00:00Z"),
    })
    .returning();
  const [conversation] = await db
    .insert(schema.agentConversationTable)
    .values({
      userId: user.id,
      workspaceId: workspace.id,
      projectId: project.id,
      title: "Plan",
    })
    .returning();
  const owner = randomUUID();
  const [run] = await db
    .insert(schema.agentRunTable)
    .values({
      conversationId: conversation.id,
      requestId: randomUUID(),
      prompt: "Read the tasks and propose a priority change",
      model: "openai/gpt-6-luna",
      status: "running",
      leaseOwner: owner,
      leaseExpiresAt: new Date(Date.now() + 60000),
    })
    .returning();
  const subject = {
    userId: user.id,
    workspaceId: workspace.id,
    projectId: project.id,
  };
  return {
    user,
    workspace,
    project,
    columns,
    task,
    conversation,
    run,
    owner,
    subject,
  };
}

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};
function stream(parts: unknown[], finish: "stop" | "tool-calls" = "stop") {
  return {
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: "stream-start", warnings: [] });
        for (const part of parts) controller.enqueue(part);
        controller.enqueue({
          type: "finish",
          finishReason: { unified: finish, raw: finish },
          usage,
        });
        controller.close();
      },
    }),
  };
}

describe("bounded agent runner", () => {
  it("runs the actual SDK tool loop, persists proposals and token usage, without mutating tasks", async () => {
    const ctx = await setup();
    const model = new MockLanguageModelV4({
      doStream: [
        stream(
          [
            {
              type: "tool-call",
              toolCallId: "read",
              toolName: "list_tasks",
              input: JSON.stringify({ limit: 10, offset: 0 }),
            },
          ],
          "tool-calls",
        ),
        stream(
          [
            {
              type: "tool-call",
              toolCallId: "proposal",
              toolName: "propose_change",
              input: JSON.stringify({
                action: {
                  type: "task.update",
                  taskId: ctx.task.id,
                  patch: { priority: "high" },
                },
                reason: "The proxy bug is overdue.",
              }),
            },
          ],
          "tool-calls",
        ),
        stream([
          { type: "text-start", id: "answer" },
          {
            type: "text-delta",
            id: "answer",
            delta: "One change is ready for review.",
          },
          { type: "text-end", id: "answer" },
        ]),
      ],
    });
    await executeAgentRun(
      ctx.run,
      ctx.conversation,
      requireAgentConfig(),
      ctx.owner,
      new AbortController().signal,
      model,
    );
    expect(
      await db.query.agentRunTable.findFirst({
        where: eq(schema.agentRunTable.id, ctx.run.id),
      }),
    ).toMatchObject({
      status: "awaiting_review",
      response: "One change is ready for review.",
      inputTokens: 30,
      outputTokens: 15,
      leaseOwner: null,
    });
    expect(await db.select().from(schema.agentStepTable)).toHaveLength(2);
    expect(await db.select().from(schema.agentProposalTable)).toHaveLength(1);
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, ctx.task.id),
      }),
    ).toMatchObject({ priority: "low" });
    expect(model.doStreamCalls).toHaveLength(3);
  });
  it("gives the model attached file contents as delimited data", async () => {
    const ctx = await setup();
    await db
      .update(schema.agentRunTable)
      .set({ attachments: [{ name: "notes.md", content: "Ship the guide" }] })
      .where(eq(schema.agentRunTable.id, ctx.run.id));
    const model = new MockLanguageModelV4({
      doStream: [
        stream([
          { type: "text-start", id: "answer" },
          { type: "text-delta", id: "answer", delta: "Read it." },
          { type: "text-end", id: "answer" },
        ]),
      ],
    });
    const [run] = await db
      .select()
      .from(schema.agentRunTable)
      .where(eq(schema.agentRunTable.id, ctx.run.id));
    await executeAgentRun(
      run,
      ctx.conversation,
      requireAgentConfig(),
      ctx.owner,
      new AbortController().signal,
      model,
    );
    const prompt = JSON.stringify(model.doStreamCalls[0]?.prompt);
    expect(prompt).toContain('<attached_file name=\\"notes.md\\">');
    expect(prompt).toContain("Ship the guide");
  });
  it("does not expose raw provider errors or credentials", async () => {
    const ctx = await setup();
    const model = new MockLanguageModelV4({
      doStream: async () => {
        throw new Error("Bearer fake-key with private request contents");
      },
    });
    await executeAgentRun(
      ctx.run,
      ctx.conversation,
      requireAgentConfig(),
      ctx.owner,
      new AbortController().signal,
      model,
    );
    const run = await db.query.agentRunTable.findFirst({
      where: eq(schema.agentRunTable.id, ctx.run.id),
    });
    expect(run?.status).toBe("failed");
    expect(run?.error).not.toContain("fake-key");
    expect(await db.select().from(schema.agentEffectTable)).toHaveLength(0);
  });
  it("rechecks permissions before spending tokens and before tool execution", async () => {
    const ctx = await setup();
    await db
      .delete(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, ctx.user.id));
    const model = new MockLanguageModelV4();
    await executeAgentRun(
      ctx.run,
      ctx.conversation,
      requireAgentConfig(),
      ctx.owner,
      new AbortController().signal,
      model,
    );
    expect(model.doStreamCalls).toHaveLength(0);
    const tools = createAgentTools(
      ctx.subject,
      ctx.run.id,
      ctx.owner,
      new AbortController().signal,
      () => {},
    );
    await expect(
      tools.list_tasks.execute!(
        { limit: 10, offset: 0 },
        { toolCallId: "late", messages: [], abortSignal: undefined },
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("marks abandoned runs and their pending steps/proposals interrupted without replaying writes", async () => {
    const ctx = await setup();
    await db.insert(schema.agentProposalTable).values({
      runId: ctx.run.id,
      action: {
        type: "task.update",
        taskId: ctx.task.id,
        patch: { priority: "high" },
      },
      reason: "Pending",
    });
    await db.insert(schema.agentStepTable).values({
      runId: ctx.run.id,
      toolCallId: "unfinished",
      toolName: "list_tasks",
      input: {},
    });
    await db
      .update(schema.agentRunTable)
      .set({ leaseExpiresAt: new Date(0) })
      .where(eq(schema.agentRunTable.id, ctx.run.id));
    await failExpiredRuns();
    expect(
      await db.query.agentRunTable.findFirst({
        where: eq(schema.agentRunTable.id, ctx.run.id),
      }),
    ).toMatchObject({ status: "failed" });
    expect(await db.query.agentProposalTable.findFirst()).toMatchObject({
      status: "discarded",
    });
    expect(await db.query.agentStepTable.findFirst()).toMatchObject({
      status: "failed",
    });
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, ctx.task.id),
      }),
    ).toMatchObject({ priority: "low" });
  });
  it("streams persisted final state without worker leases", async () => {
    const ctx = await setup();
    await db
      .update(schema.agentRunTable)
      .set({ status: "completed", response: "Ready" })
      .where(eq(schema.agentRunTable.id, ctx.run.id));
    mockAuthenticatedSession(ctx.user);
    const { app } = createApp();
    const response = await app.request(
      `/api/agent/${ctx.workspace.id}/runs/${ctx.run.id}/events`,
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("event: run");
    expect(body).toContain("event: done");
    expect(body).toContain("Ready");
    expect(body).not.toContain("leaseOwner");
  });
});

describe("agent context reads", () => {
  it("only reads and changes projects the member can access", async () => {
    const ctx = await createRestrictedWorkspace();
    const subject = {
      userId: ctx.restricted.id,
      workspaceId: ctx.workspace.id,
      projectId: null,
    };
    expect(await readProjects(subject)).toEqual([
      expect.objectContaining({ id: ctx.alpha.id }),
    ]);
    expect(
      (await readTasks(subject, { limit: 10, offset: 0 })).tasks.map(
        (task) => task.id,
      ),
    ).toEqual([ctx.alphaTask.id]);
    await expect(readTask(subject, ctx.betaTask.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      readTasks(subject, { projectId: ctx.beta.id, limit: 10, offset: 0 }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      validateAction(subject, {
        type: "task.update",
        taskId: ctx.betaTask.id,
        patch: { priority: "high" },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("refuses archived workspaces", async () => {
    const ctx = await setup();
    await db
      .update(schema.workspaceTable)
      .set({ archivedAt: new Date() })
      .where(eq(schema.workspaceTable.id, ctx.workspace.id));
    await expect(assertAgentAccess(ctx.subject)).rejects.toMatchObject({
      status: 403,
    });
  });
  it("does not send oversized database content into the model context", async () => {
    const ctx = await setup();
    await db
      .update(schema.taskTable)
      .set({ title: "x".repeat(100001) })
      .where(eq(schema.taskTable.id, ctx.task.id));
    const tools = createAgentTools(
      ctx.subject,
      ctx.run.id,
      ctx.owner,
      new AbortController().signal,
      () => {},
    );
    expect(
      await tools.list_tasks.execute!(
        { limit: 10, offset: 0 },
        { toolCallId: "oversized", messages: [], abortSignal: undefined },
      ),
    ).toEqual({ error: "Agent tool result budget exhausted" });
    expect(await db.query.agentStepTable.findFirst()).toMatchObject({
      status: "failed",
    });
  });
  it("lists the current project with null scope and rejects invented filters", async () => {
    const ctx = await setup();
    const tools = createAgentTools(
      ctx.subject,
      ctx.run.id,
      ctx.owner,
      new AbortController().signal,
      () => {},
    );
    const input = { projectId: null, limit: 10, offset: 0 };
    expect(tools.list_tasks.inputSchema.parse(input)).toEqual(input);
    expect(() =>
      tools.list_tasks.inputSchema.parse({
        ...input,
        status: "all",
        userId: "all",
      }),
    ).toThrow();
    expect(
      await tools.list_tasks.execute!(input, {
        toolCallId: "scope",
        messages: [],
        abortSignal: undefined,
      }),
    ).toMatchObject({ tasks: [{ id: ctx.task.id }], nextOffset: null });
  });
  it("bounds descriptions and correctly paginates literal title searches", async () => {
    const ctx = await setup();
    const task = await readTask(ctx.subject, ctx.task.id);
    expect(task.description).toHaveLength(8000);
    expect(task.descriptionTruncated).toBe(true);
    for (let index = 2; index < 5; index++)
      await db.insert(schema.taskTable).values({
        projectId: ctx.project.id,
        number: index,
        title: `Task ${index}`,
      });
    const first = await readTasks(ctx.subject, { limit: 2, offset: 0 });
    expect(first.tasks).toHaveLength(2);
    expect(first.nextOffset).toBe(2);
    const second = await readTasks(ctx.subject, {
      limit: 2,
      offset: first.nextOffset!,
    });
    expect(second.tasks).toHaveLength(2);
    expect(second.nextOffset).toBeNull();
    expect(
      (await readTasks(ctx.subject, { query: "%", limit: 2, offset: 0 })).tasks,
    ).toEqual([]);
  });
  it("computes workload from all matching tasks and excludes final columns and archived tasks", async () => {
    const ctx = await setup();
    await db.insert(schema.taskTable).values([
      {
        projectId: ctx.project.id,
        number: 2,
        title: "Finished",
        status: "done",
        columnId: ctx.columns.done.id,
      },
      {
        projectId: ctx.project.id,
        number: 3,
        title: "Archived",
        status: "archived",
      },
    ]);
    expect(
      await readWorkload(ctx.subject, {
        from: "2026-09-30T00:00:00Z",
        to: "2026-10-06T00:00:00Z",
      }),
    ).toEqual([
      {
        userId: null,
        openTasks: 1,
        dueInPeriod: 1,
        overdueTasks: 1,
        projectIds: [ctx.project.id],
      },
    ]);
  });
});

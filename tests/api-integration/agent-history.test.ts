import { randomUUID } from "node:crypto";
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
import { requireAgentConfig } from "../../apps/api/src/agent/config";
import { executeAgentRun } from "../../apps/api/src/agent/runner";
import { applyProposals } from "../../apps/api/src/agent/controllers/apply-proposals";
import { discardProposals } from "../../apps/api/src/agent/controllers/discard-proposals";
import { undoProposal } from "../../apps/api/src/agent/controllers/undo-proposal";
import { resetTestDatabase } from "./helpers/database";
import { createSharedAgentWorkspace } from "./helpers/agent/shared-agent-workspace";
import { scriptedModel } from "./helpers/agent/scripted-model";

type Context = Awaited<ReturnType<typeof createSharedAgentWorkspace>>;
type Conversation = typeof schema.agentConversationTable.$inferSelect;
type ExecutionRecord = {
  turn: number;
  tools: Array<{ toolName: string; status: string }>;
  proposals: Array<{
    type: string;
    status: string;
    taskId: string | null;
    jobId?: string | null;
  }>;
};

beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("KANEO_AGENT_ENABLED", "true");
  vi.stubEnv("OPENROUTER_API_KEY", "fake-test-key");
  vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-6-luna");
});
afterEach(() => vi.unstubAllEnvs());

async function capture(
  ctx: Context,
  conversation: Conversation,
  calls: Array<{ toolName: string; input: unknown }> = [],
) {
  const owner = randomUUID();
  const run = await ctx.insertRun(conversation.id, {
    status: "running",
    leaseOwner: owner,
    leaseExpiresAt: new Date(Date.now() + 60000),
  });
  const model = scriptedModel(calls, "Read the recorded history.");
  await executeAgentRun(
    run,
    conversation,
    requireAgentConfig(),
    owner,
    new AbortController().signal,
    model,
  );
  expect(
    await db.query.agentRunTable.findFirst({
      where: eq(schema.agentRunTable.id, run.id),
    }),
  ).toMatchObject({ status: "completed", error: null });
  const prompt = model.doStreamCalls[0]!.prompt;
  const system = prompt.find((message) => message.role === "system")!.content;
  const block =
    /<previous_run_execution>\n(.*?)\n<\/previous_run_execution>/s.exec(system);
  return {
    runId: run.id,
    records: (block ? JSON.parse(block[1]!) : []) as ExecutionRecord[],
    prompt,
    system,
    serialized: JSON.stringify(prompt),
  };
}

function subject(ctx: Context, conversation: Conversation) {
  return {
    userId: ctx.owner.id,
    workspaceId: ctx.workspace.id,
    projectId: conversation.projectId,
  };
}

describe("recorded agent conversation history", () => {
  it.each(["pending", "applied", "discarded", "undone"] as const)(
    "sends actual tools and the persisted %s proposal state to the next SDK call",
    async (status) => {
      const ctx = await createSharedAgentWorkspace();
      const conversation = await ctx.conversation(ctx.alpha.id);
      const original = await ctx.execute(conversation, [
        { toolName: "get_task", input: { taskId: ctx.alphaTask.id } },
        {
          toolName: "propose_change",
          input: {
            action: {
              type: "task.update",
              taskId: ctx.alphaTask.id,
              patch: { priority: "high" },
            },
            reason: "Prioritize this fixture.",
          },
        },
      ]);
      const [proposal] = await db
        .select()
        .from(schema.agentProposalTable)
        .where(eq(schema.agentProposalTable.runId, original.id));
      if (status === "applied" || status === "undone")
        await applyProposals(subject(ctx, conversation), original.id, [
          proposal!.id,
        ]);
      if (status === "discarded")
        await discardProposals(subject(ctx, conversation), original.id, [
          proposal!.id,
        ]);
      if (status === "undone")
        await undoProposal(subject(ctx, conversation), proposal!.id);
      const history = await capture(ctx, conversation);
      expect(history.records).toEqual([
        {
          turn: 1,
          tools: [
            { toolName: "get_task", status: "completed" },
            { toolName: "propose_change", status: "completed" },
          ],
          proposals: [
            { type: "task.update", status, taskId: ctx.alphaTask.id },
          ],
        },
      ]);
      expect(history.system).toContain(
        "Historical tool calls are not replayed",
      );
      expect(history.system).toContain(
        "You may acknowledge a human-applied or undone change",
      );
      expect(history.prompt.some((message) => message.role === "tool")).toBe(
        false,
      );
      expect(history.system).not.toContain("Prioritize this fixture.");
    },
  );

  it("supplies the actual created task ID only after human approval", async () => {
    const ctx = await createSharedAgentWorkspace();
    const conversation = await ctx.conversation(ctx.alpha.id);
    const original = await ctx.execute(conversation, [
      {
        toolName: "propose_change",
        input: {
          action: {
            type: "task.create",
            projectId: ctx.alpha.id,
            title: "Created history fixture",
            status: "to-do",
            priority: "medium",
          },
          reason: "Create a fixture.",
        },
      },
    ]);
    const [proposal] = await db
      .select()
      .from(schema.agentProposalTable)
      .where(eq(schema.agentProposalTable.runId, original.id));
    const pending = await capture(ctx, conversation);
    expect(pending.records[0]!.proposals).toEqual([
      { type: "task.create", status: "pending", taskId: null },
    ]);
    await applyProposals(subject(ctx, conversation), original.id, [
      proposal!.id,
    ]);
    const persisted = await db.query.agentProposalTable.findFirst({
      where: eq(schema.agentProposalTable.id, proposal!.id),
    });
    const task = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, persisted!.after!.id),
    });
    expect(task?.title).toBe("Created history fixture");
    const applied = await capture(ctx, conversation);
    expect(applied.records[0]!.proposals).toEqual([
      { type: "task.create", status: "applied", taskId: task!.id },
    ]);
    expect(applied.system).not.toContain("Created history fixture");
  });

  it("distinguishes an applied coding proposal from completed code execution", async () => {
    const ctx = await createSharedAgentWorkspace();
    const conversation = await ctx.conversation(ctx.alpha.id);
    const run = await ctx.insertRun(conversation.id);
    const jobId = randomUUID();
    await db.insert(schema.agentProposalTable).values({
      runId: run.id,
      status: "applied",
      action: {
        type: "code.run",
        taskId: ctx.alphaTask.id,
        integrationId: randomUUID(),
        instructions:
          "Private coding instructions must not enter the history evidence.",
        baseRef: "main",
      },
      reason: "Coding proposal fixture",
      after: {
        id: ctx.alphaTask.id,
        projectId: ctx.alpha.id,
        title: ctx.alphaTask.title,
        status: ctx.alphaTask.status,
        priority: ctx.alphaTask.priority,
        userId: null,
        dueDate: null,
        jobId,
      },
    });
    const history = await capture(ctx, conversation);
    expect(history.records[0]!.proposals).toEqual([
      {
        type: "code.run",
        status: "applied",
        taskId: ctx.alphaTask.id,
        jobId,
      },
    ]);
    expect(history.system).toContain(
      "For code.run, applied means a coding job was created",
    );
    expect(history.system).not.toContain("Private coding instructions");
  });

  it("keeps the existing four-turn window and excludes other conversations and unsuccessful runs", async () => {
    const ctx = await createSharedAgentWorkspace();
    const conversation = await ctx.conversation(ctx.alpha.id);
    for (let i = 0; i < 5; i++) {
      const run = await ctx.insertRun(conversation.id, {
        prompt: `Historical turn ${i}`,
        response: `Historical answer ${i}`,
        createdAt: new Date(Date.UTC(2026, 0, 1, 9, i)),
      });
      await db.insert(schema.agentStepTable).values({
        runId: run.id,
        toolCallId: `call-${i}`,
        toolName: `history-tool-${i}`,
        status: "completed",
        input: {},
      });
    }
    const foreign = await ctx.conversation(ctx.beta.id);
    const foreignRun = await ctx.insertRun(foreign.id, {
      prompt: "Foreign private conversation",
      response: "Foreign private response",
    });
    await db.insert(schema.agentStepTable).values({
      runId: foreignRun.id,
      toolCallId: "foreign-call",
      toolName: "foreign-private-tool",
      status: "completed",
      input: {},
    });
    for (const status of ["queued", "failed", "cancelled"] as const)
      await ctx.insertRun(conversation.id, {
        status,
        response: `Excluded ${status} response`,
      });
    const history = await capture(ctx, conversation);
    expect(history.records).toHaveLength(4);
    expect(history.records.map((record) => record.tools[0]?.toolName)).toEqual(
      [1, 2, 3, 4].map((index) => `history-tool-${index}`),
    );
    expect(history.serialized).not.toContain("Historical turn 0");
    expect(history.serialized).not.toContain("Foreign private");
    expect(history.serialized).not.toContain("foreign-private-tool");
    expect(history.serialized).not.toContain("Excluded");
  });

  it("does not expose another project's metadata or grant a new read capability", async () => {
    const ctx = await createSharedAgentWorkspace();
    const foreign = await ctx.conversation(ctx.beta.id);
    const foreignRun = await ctx.execute(foreign, [
      { toolName: "get_task", input: { taskId: ctx.betaTask.id } },
      {
        toolName: "propose_change",
        input: {
          action: {
            type: "task.update",
            taskId: ctx.betaTask.id,
            patch: { priority: "high" },
          },
          reason: "Private beta proposal",
        },
      },
    ]);
    expect(await ctx.status(ctx.restricted, `/runs/${foreignRun.id}`)).toBe(
      404,
    );
    const conversation = await ctx.conversation(ctx.alpha.id);
    const history = await capture(ctx, conversation, [
      { toolName: "get_task", input: { taskId: ctx.betaTask.id } },
    ]);
    expect(history.records).toEqual([]);
    expect(history.serialized).not.toContain(ctx.betaTask.id);
    expect(history.serialized).not.toContain("Private beta proposal");
    const [step] = await db
      .select()
      .from(schema.agentStepTable)
      .where(eq(schema.agentStepTable.runId, history.runId));
    expect(step).toMatchObject({ toolName: "get_task", status: "failed" });
    const next = await capture(ctx, conversation);
    expect(next.records[0]!.tools).toEqual([
      { toolName: "get_task", status: "failed" },
    ]);
    expect(next.serialized).not.toContain(ctx.betaTask.id);
    expect(next.system).not.toContain(step!.summary);
    expect(history.system).not.toContain("Never claim a change was applied");
  });
});

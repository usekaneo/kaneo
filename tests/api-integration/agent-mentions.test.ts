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
import { requireAgentConfig } from "../../apps/api/src/agent/config";
import { executeAgentRun } from "../../apps/api/src/agent/runner";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createRestrictedWorkspace } from "./helpers/project-access/create-restricted-workspace";

beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("KANEO_AGENT_ENABLED", "true");
  vi.stubEnv("OPENROUTER_API_KEY", "fake-test-key");
  vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-6-luna");
});
afterEach(() => vi.unstubAllEnvs());

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};
const answer = () => ({
  stream: new ReadableStream({
    start(controller) {
      controller.enqueue({ type: "stream-start", warnings: [] });
      controller.enqueue({ type: "text-start", id: "a" });
      controller.enqueue({ type: "text-delta", id: "a", delta: "Seen." });
      controller.enqueue({ type: "text-end", id: "a" });
      controller.enqueue({
        type: "finish",
        finishReason: { unified: "stop", raw: "stop" },
        usage,
      });
      controller.close();
    },
  }),
});

async function setup(as: "restricted" | "owner" = "restricted") {
  const ctx = await createRestrictedWorkspace();
  mockAuthenticatedSession(as === "owner" ? ctx.owner : ctx.restricted);
  const { app } = createApp();
  const base = `/api/agent/${ctx.workspace.id}`;
  const post = (path: string, body: unknown) =>
    app.request(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const startConversation = async (projectId?: string) => {
    const conversation = await (
      await post("/conversations", projectId ? { projectId } : {})
    ).json();
    return (body: unknown) =>
      post(`/conversations/${conversation.id}/runs`, body);
  };
  return { ...ctx, startConversation };
}

async function execute(runId: string) {
  const owner = randomUUID();
  const [run] = await db
    .update(schema.agentRunTable)
    .set({
      status: "running",
      leaseOwner: owner,
      leaseExpiresAt: new Date(Date.now() + 60000),
    })
    .where(eq(schema.agentRunTable.id, runId))
    .returning();
  const conversation = await db.query.agentConversationTable.findFirst({
    where: eq(schema.agentConversationTable.id, run.conversationId),
  });
  if (!run || !conversation) throw new Error("Run not found");
  const model = new MockLanguageModelV4({ doStream: [answer()] });
  await executeAgentRun(
    run,
    conversation,
    requireAgentConfig(),
    owner,
    new AbortController().signal,
    model,
  );
  const prompt = model.doStreamCalls[0]?.prompt.at(-1);
  return JSON.stringify(prompt);
}

describe("agent run mentions", () => {
  it("queues a prompt with mentions and treats them as part of the idempotency key", async () => {
    const ctx = await setup();
    const createRun = await ctx.startConversation();
    const requestId = randomUUID();
    const body = {
      requestId,
      prompt: `Summarize @[${ctx.alpha.name}](project:${ctx.alpha.id})`,
      mentions: [{ type: "project", id: ctx.alpha.id }],
    };
    const created = await createRun(body);
    expect(created.status).toBe(202);
    const run = await created.json();

    const retried = await createRun(body);
    expect(retried.status).toBe(202);
    expect((await retried.json()).id).toBe(run.id);

    const conflict = await createRun({
      requestId,
      prompt: `Summarize @[${ctx.alphaTask.title}](task:${ctx.alphaTask.id})`,
      mentions: [{ type: "task", id: ctx.alphaTask.id }],
    });
    expect(conflict.status).toBe(409);

    const mismatch = await createRun({
      requestId: randomUUID(),
      prompt: "Summarize the project",
      mentions: [{ type: "project", id: ctx.alpha.id }],
    });
    expect(mismatch.status).toBe(400);
  });

  it("gives the model current details for accessible mentions and silently drops the rest", async () => {
    const ctx = await setup();
    const createRun = await ctx.startConversation();
    const prompt = [
      `Compare @[Visible](task:${ctx.alphaTask.id})`,
      `with @[Hidden](task:${ctx.betaTask.id})`,
      `in @[Beta](project:${ctx.beta.id})`,
      `and @[Missing](task:does-not-exist)`,
    ].join(" ");
    const created = await createRun({
      requestId: randomUUID(),
      prompt,
      mentions: [
        { type: "task", id: ctx.alphaTask.id },
        { type: "task", id: ctx.betaTask.id },
        { type: "project", id: ctx.beta.id },
        { type: "task", id: "does-not-exist" },
      ],
    });
    expect(created.status).toBe(202);

    const input = await execute((await created.json()).id);
    expect(input).toContain("<mentioned_items>");
    expect(input).toContain("Visible alpha task");
    expect(input).toContain(`project=\\"${ctx.alpha.name}\\"`);
    expect(input).not.toContain("Hidden beta task");
    const block = input.slice(input.indexOf("<mentioned_items>"));
    expect(block).not.toContain(ctx.betaTask.id);
    expect(block).not.toContain(ctx.beta.id);
    expect(block).not.toContain("does-not-exist");
  });

  it("drops mentions outside a project-scoped conversation", async () => {
    // The owner can see beta, but a conversation scoped to the alpha board
    // panel cannot.
    const ctx = await setup("owner");
    const createRun = await ctx.startConversation(ctx.alpha.id);
    const created = await createRun({
      requestId: randomUUID(),
      prompt: `Link @[A](task:${ctx.alphaTask.id}) and @[B](task:${ctx.betaTask.id})`,
      mentions: [
        { type: "task", id: ctx.alphaTask.id },
        { type: "task", id: ctx.betaTask.id },
      ],
    });
    expect(created.status).toBe(202);

    const input = await execute((await created.json()).id);
    expect(input).toContain("Visible alpha task");
    expect(input).not.toContain("Hidden beta task");
  });
});

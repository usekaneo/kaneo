import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { deleteAutomation } from "../../apps/api/src/agent/automation/controllers/delete";
import { saveAutomation } from "../../apps/api/src/agent/automation/controllers/save";
import { takeOverAutomation } from "../../apps/api/src/agent/automation/controllers/take-over";
import { runAutomationNow } from "../../apps/api/src/agent/automation/controllers/run-now";
import {
  automationFixture,
  automationMember,
} from "./helpers/agent-automation";
import { resetTestDatabase } from "./helpers/database";

beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("KANEO_AGENT_ENABLED", "true");
  vi.stubEnv("OPENROUTER_API_KEY", "fake-key");
  vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-6-luna");
  vi.stubEnv("KANEO_CLOUD", "false");
});
afterEach(() => vi.unstubAllEnvs());

it.each(["delete", "scope", "takeover"] as const)(
  "%s cancels active runs and cleans pending proposals and running steps atomically",
  async (operation) => {
    const ctx = await automationFixture();
    const queued = await runAutomationNow(ctx.subject, ctx.id);
    const [run] = await db
      .update(schema.agentRunTable)
      .set({
        status: "running",
        leaseOwner: "previous-worker",
        leaseExpiresAt: new Date(Date.now() + 60000),
      })
      .where(eq(schema.agentRunTable.id, queued.id))
      .returning();
    const [proposal] = await db
      .insert(schema.agentProposalTable)
      .values({
        runId: run!.id,
        action: {
          type: "task.update",
          taskId: ctx.task!.id,
          patch: { priority: "high" },
        },
        reason: "Review priority",
      })
      .returning();
    const [step] = await db
      .insert(schema.agentStepTable)
      .values({
        runId: run!.id,
        toolCallId: "interrupted-call",
        toolName: "get_task",
        input: { taskId: ctx.task!.id },
        status: "running",
      })
      .returning();
    const [completed] = await db
      .insert(schema.agentRunTable)
      .values({
        conversationId: run!.conversationId,
        requestId: randomUUID(),
        prompt: "Earlier answer",
        model: run!.model,
        status: "completed",
      })
      .returning();

    if (operation === "delete") await deleteAutomation(ctx.subject, ctx.id);
    else if (operation === "scope")
      await saveAutomation(
        ctx.subject,
        { ...ctx.input, projectId: null },
        ctx.id,
      );
    else {
      const { user } = await automationMember(ctx.workspace.id);
      await takeOverAutomation({ ...ctx.subject, userId: user.id }, ctx.id);
    }

    const cancelled = await db.query.agentRunTable.findFirst({
      where: eq(schema.agentRunTable.id, run!.id),
    });
    const discarded = await db.query.agentProposalTable.findFirst({
      where: eq(schema.agentProposalTable.id, proposal!.id),
    });
    const failed = await db.query.agentStepTable.findFirst({
      where: eq(schema.agentStepTable.id, step!.id),
    });
    expect(cancelled).toMatchObject({
      status: "cancelled",
      leaseOwner: null,
      leaseExpiresAt: null,
    });
    expect(discarded?.status).toBe("discarded");
    expect(failed).toMatchObject({
      status: "failed",
      summary: "Run cancelled",
    });
    expect(failed?.finishedAt).toEqual(cancelled?.finishedAt);
    expect(
      await db.query.agentRunTable.findFirst({
        where: eq(schema.agentRunTable.id, completed!.id),
      }),
    ).toMatchObject({ status: "completed" });
  },
);

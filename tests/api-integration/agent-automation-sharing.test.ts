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
import { saveAutomation } from "../../apps/api/src/agent/automation/controllers/save";
import { runAutomationNow } from "../../apps/api/src/agent/automation/controllers/run-now";
import { createAutomationSchema } from "../../apps/api/src/agent/automation/schema";
import { ingestAutomationEvent } from "../../apps/api/src/agent/automation/ingest-event";
import { tickAutomations } from "../../apps/api/src/agent/automation/tick";
import { resetTestDatabase } from "./helpers/database";
import { createSharedAgentWorkspace } from "./helpers/agent/shared-agent-workspace";
import { scriptedModel } from "./helpers/agent/scripted-model";
import { executeQueuedAutomationRun } from "./helpers/agent-automation";

beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("KANEO_AGENT_ENABLED", "true");
  vi.stubEnv("OPENROUTER_API_KEY", "fake-key");
  vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-6-luna");
  vi.stubEnv("KANEO_AGENT_WORKSPACE_MONTHLY_USD", "");
});
afterEach(() => vi.unstubAllEnvs());

async function fixture(input: Record<string, unknown> = {}) {
  const ctx = await createSharedAgentWorkspace();
  const subject = {
    userId: ctx.owner.id,
    workspaceId: ctx.workspace.id,
    projectId: null,
  };
  const id = await saveAutomation(
    subject,
    createAutomationSchema.parse({
      name: "Review",
      prompt: "Review the work",
      output: "digest",
      trigger: { type: "schedule", frequency: "daily", time: "09:00" },
      ...input,
    }),
  );
  const [conversation] = await db
    .update(schema.agentConversationTable)
    .set({ sharedAt: new Date() })
    .where(eq(schema.agentConversationTable.automationId, id))
    .returning();
  return { ...ctx, subject, id, thread: conversation! };
}

const sorted = (...ids: string[]) => ids.sort();

describe("automation touched-project sharing", () => {
  it("records scope at queue time and read tools, mentions, and history for digest runs", async () => {
    const ctx = await fixture();
    // A scoped manual run starts protected even before the worker executes.
    const scopedId = await saveAutomation(
      ctx.subject,
      createAutomationSchema.parse({
        name: "Scoped",
        prompt: "Review",
        output: "digest",
        projectId: ctx.beta.id,
        trigger: { type: "schedule", frequency: "daily" },
      }),
    );
    const scoped = await runAutomationNow(ctx.subject, scopedId);
    const [queuedScope] = await db
      .select()
      .from(schema.agentRunTable)
      .where(eq(schema.agentRunTable.id, scoped.id));
    expect(queuedScope?.touchedProjectIds).toEqual([ctx.beta.id]);
    const scopedRun = await executeQueuedAutomationRun(scoped.id);
    expect(scopedRun.touchedProjectIds).toEqual([ctx.beta.id]);

    await db
      .update(schema.agentAutomationTable)
      .set({ prompt: `Review @[Alpha](project:${ctx.alpha.id})` })
      .where(eq(schema.agentAutomationTable.id, ctx.id));
    const queued = await runAutomationNow(ctx.subject, ctx.id);
    const model = scriptedModel([
      { toolName: "get_task", input: { taskId: ctx.betaTask.id } },
    ]);
    const run = await executeQueuedAutomationRun(queued.id, model);
    expect(run.status).toBe("completed");
    expect(run.touchedProjectIds).toEqual(sorted(ctx.alpha.id, ctx.beta.id));
    expect(
      model.doStreamCalls[0]!.tools?.map((tool) => tool.name),
    ).not.toContain("propose_change");
    const next = await runAutomationNow(ctx.subject, ctx.id);
    const inherited = await executeQueuedAutomationRun(next.id);
    expect(inherited.touchedProjectIds).toEqual(run.touchedProjectIds);
    expect(await ctx.status(ctx.restricted, `/runs/${inherited.id}`)).toBe(404);
    expect(await ctx.status(ctx.viewer, `/runs/${inherited.id}`)).toBe(200);
  });

  it("protects queued event snapshots and adds the triggering task's project after a move", async () => {
    const ctx = await fixture({
      trigger: { type: "event", event: "task_created" },
    });
    const now = new Date();
    await ingestAutomationEvent(
      "task_created",
      {
        taskId: ctx.betaTask.id,
        projectId: ctx.beta.id,
      },
      randomUUID(),
      new Date(now.getTime() - 6 * 60000),
    );
    await tickAutomations(now);
    const [queued] = await db
      .select()
      .from(schema.agentRunTable)
      .where(eq(schema.agentRunTable.conversationId, ctx.thread.id));
    expect(queued?.touchedProjectIds).toEqual([ctx.beta.id]);
    expect(queued?.trigger?.events[0]?.projectId).toBe(ctx.beta.id);
    for (const path of [
      `/runs/${queued!.id}`,
      `/runs/${queued!.id}/events`,
      `/conversations/${ctx.thread.id}`,
      `/automations/${ctx.id}`,
      `/automations/${ctx.id}/runs`,
    ])
      expect(await ctx.status(ctx.restricted, path)).toBe(404);
    const hiddenList = await ctx.json(
      ctx.restricted,
      "/automations?kind=agent",
    );
    expect(hiddenList.items).toEqual([]);
    expect(hiddenList.total).toBe(0);
    expect(await ctx.status(ctx.viewer, `/runs/${queued!.id}`)).toBe(200);

    await db
      .update(schema.taskTable)
      .set({
        projectId: ctx.alpha.id,
        columnId: ctx.alphaTask.columnId,
        number: 2,
      })
      .where(eq(schema.taskTable.id, ctx.betaTask.id));
    const run = await executeQueuedAutomationRun(queued!.id);
    expect(run.status).toBe("completed");
    expect(run.touchedProjectIds).toEqual(sorted(ctx.alpha.id, ctx.beta.id));
    expect(await ctx.status(ctx.restricted, `/runs/${run.id}`)).toBe(404);
    const publicRun = await ctx.json(ctx.viewer, `/runs/${run.id}`);
    expect(publicRun).not.toHaveProperty("touchedProjectIds");
    expect(publicRun).not.toHaveProperty("automationHandledAt");
  });

  it("records projects from the full event batch when displayed snapshots are truncated", async () => {
    const ctx = await fixture({
      trigger: { type: "event", event: "task_created" },
    });
    const now = new Date();
    for (let index = 0; index < 21; index++) {
      const task = index < 20 ? ctx.alphaTask : ctx.betaTask;
      await ingestAutomationEvent(
        "task_created",
        {
          taskId: task.id,
          projectId: task.projectId,
        },
        randomUUID(),
        new Date(now.getTime() - 6 * 60000 + index),
      );
    }
    await tickAutomations(now);
    const [run] = await db
      .select()
      .from(schema.agentRunTable)
      .where(eq(schema.agentRunTable.conversationId, ctx.thread.id));
    expect(run?.trigger?.events).toHaveLength(20);
    expect(
      run?.trigger?.events.every((event) => event.projectId === ctx.alpha.id),
    ).toBe(true);
    expect(run?.trigger?.moreEvents).toBe(1);
    expect(run?.touchedProjectIds).toEqual(sorted(ctx.alpha.id, ctx.beta.id));
    expect(await ctx.status(ctx.restricted, `/runs/${run!.id}`)).toBe(404);
  });

  it("filters automation history before pagination, latest-run summaries, and monthly costs", async () => {
    const ctx = await fixture();
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const runs = [];
    for (const [index, projectId] of [
      ctx.alpha.id,
      ctx.beta.id,
      ctx.alpha.id,
      ctx.beta.id,
    ].entries()) {
      runs.push(
        await ctx.insertRun(ctx.thread.id, {
          createdAt: new Date(start.getTime() + index * 60000),
          touchedProjectIds: [projectId],
          costUsd: projectId === ctx.alpha.id ? "1" : "10",
        }),
      );
    }
    const page = await ctx.json(
      ctx.restricted,
      `/automations/${ctx.id}/runs?limit=1&offset=1`,
    );
    expect(page.map((run: { id: string }) => run.id)).toEqual([runs[0]!.id]);
    const list = await ctx.json(ctx.restricted, "/automations?kind=agent");
    expect(list.items[0].lastRun.id).toBe(runs[2]!.id);
    const detail = await ctx.json(ctx.restricted, `/automations/${ctx.id}`);
    expect(detail.monthCostUsd).toBe("2");
    expect(
      (await ctx.json(ctx.owner, `/automations/${ctx.id}`)).monthCostUsd,
    ).toBe("22");
    expect(
      await ctx.json(ctx.viewer, `/automations/${ctx.id}/runs`),
    ).toHaveLength(4);

    // Admin management access must not expose a fully hidden thread or its cost.
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "admin" })
      .where(eq(schema.workspaceUserTable.userId, ctx.restricted.id));
    await db
      .update(schema.agentRunTable)
      .set({ touchedProjectIds: [ctx.beta.id] })
      .where(eq(schema.agentRunTable.conversationId, ctx.thread.id));
    const redacted = await ctx.json(ctx.restricted, `/automations/${ctx.id}`);
    expect(redacted).toMatchObject({
      prompt: null,
      conversationId: null,
      monthCostUsd: "0",
    });
    expect(
      await ctx.status(ctx.restricted, `/automations/${ctx.id}/runs`),
    ).toBe(404);
    const adminList = await ctx.json(ctx.restricted, "/automations?kind=agent");
    expect(adminList.items[0].lastRun).toBeNull();
  });
});

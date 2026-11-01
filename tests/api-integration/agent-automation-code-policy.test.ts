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
import { runAutomationNow } from "../../apps/api/src/agent/automation/controllers/run-now";
import { createProposal } from "../../apps/api/src/agent/controllers/create-proposal";
import { applyProposals } from "../../apps/api/src/agent/controllers/apply-proposals";
import { shutdownEventBus } from "../../apps/api/src/events";
import { resetTestDatabase } from "./helpers/database";
import {
  automationFixture,
  automationModel,
  executeAutomationRun,
} from "./helpers/agent-automation";

beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("KANEO_AGENT_ENABLED", "true");
  vi.stubEnv("OPENROUTER_API_KEY", "fake-key");
  vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-6-luna");
  vi.stubEnv("KANEO_AGENT_WORKSPACE_MONTHLY_USD", "");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await shutdownEventBus();
});

describe.each(["digest", "proposals"] as const)(
  "%s automation coding policy",
  (output) => {
    it("omits coding tools from the model", async () => {
      const ctx = await automationFixture({ output });
      const model = automationModel();
      await executeAutomationRun(ctx.subject, ctx.id, model);
      const names = model.doStreamCalls[0]!.tools?.map((tool) => tool.name);
      expect(names).not.toContain("list_code_repositories");
      expect(names).not.toContain("propose_code_job");
      expect(JSON.stringify(model.doStreamCalls[0]!.tools)).not.toContain(
        "code.run",
      );
      if (output === "digest") expect(names).not.toContain("propose_change");
      else expect(names).toContain("propose_change");
    });

    it("rejects code proposals at persistence and application, including forged pending data", async () => {
      const ctx = await automationFixture({ output });
      const run = await runAutomationNow(ctx.subject, ctx.id);
      await db
        .update(schema.agentRunTable)
        .set({
          status: "running",
          leaseOwner: "test",
          leaseExpiresAt: new Date(Date.now() + 60000),
        })
        .where(eq(schema.agentRunTable.id, run.id));
      const action = {
        type: "code.run" as const,
        taskId: ctx.task.id,
        integrationId: "fake-integration",
        instructions: "Fix reconnect",
      };
      await expect(
        createProposal(ctx.subject, run.id, { action, reason: "Fix" }, "test"),
      ).rejects.toMatchObject({ status: 403 });
      const [proposal] = await db
        .insert(schema.agentProposalTable)
        .values({ runId: run.id, action, reason: "Forged" })
        .returning();
      await db
        .update(schema.agentRunTable)
        .set({ status: "awaiting_review" })
        .where(eq(schema.agentRunTable.id, run.id));
      expect(
        await applyProposals(ctx.subject, run.id, [proposal!.id]),
      ).toMatchObject({ results: [{ status: "failed", code: 403 }] });
      expect(await db.select().from(schema.agentJobTable)).toHaveLength(0);
    });
  },
);

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
import * as access from "../../apps/api/src/agent/access";
import { getRun } from "../../apps/api/src/agent/controllers/get-run";
import { recordTouchedProjects } from "../../apps/api/src/agent/record-touched-projects";
import { createSharedAgentWorkspace } from "./helpers/agent/shared-agent-workspace";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";
import { resetTestDatabase } from "./helpers/database";

beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("KANEO_AGENT_ENABLED", "true");
  vi.stubEnv("OPENROUTER_API_KEY", "fake-test-key");
  vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-6-luna");
});
afterEach(() => vi.unstubAllEnvs());

describe("current project access on shared runs", () => {
  it("checks all projects and reflects revoked and restored access", async () => {
    const ctx = await createSharedAgentWorkspace();
    const run = await ctx.execute(await ctx.conversation(), [
      { toolName: "list_tasks", input: { limit: 10, offset: 0 } },
    ]);
    expect(await ctx.status(ctx.viewer, `/runs/${run.id}`)).toBe(200);
    expect(await ctx.status(ctx.restricted, `/runs/${run.id}`)).toBe(404);
    await restrictToProjects(ctx.workspace.id, ctx.viewer.id, [ctx.alpha.id]);
    expect(await ctx.status(ctx.viewer, `/runs/${run.id}`)).toBe(404);
    expect(await ctx.json(ctx.viewer, "/runs")).toEqual([]);
    await restrictToProjects(ctx.workspace.id, ctx.viewer.id, [
      ctx.alpha.id,
      ctx.beta.id,
    ]);
    expect(await ctx.status(ctx.viewer, `/runs/${run.id}`)).toBe(200);
  });

  it("honors instance-admin access without bypassing unknown legacy projects", async () => {
    const ctx = await createSharedAgentWorkspace();
    const thread = await ctx.conversation();
    const known = await ctx.insertRun(thread.id, {
      touchedProjectIds: [ctx.beta.id],
    });
    const unknown = await ctx.insertRun(thread.id, {
      touchedProjectIds: ["*"],
    });
    await db
      .update(schema.userTable)
      .set({ role: "admin" })
      .where(eq(schema.userTable.id, ctx.restricted.id));
    expect(await ctx.status(ctx.restricted, `/runs/${known.id}`)).toBe(200);
    expect(await ctx.status(ctx.restricted, `/runs/${unknown.id}`)).toBe(404);
    expect(
      (await ctx.json(ctx.restricted, "/runs")).map(
        (run: { id: string }) => run.id,
      ),
    ).toEqual([known.id]);
  });

  it("keeps deleted touched projects owner-only", async () => {
    const ctx = await createSharedAgentWorkspace();
    const run = await ctx.execute(await ctx.conversation(), [
      { toolName: "get_task", input: { taskId: ctx.betaTask.id } },
    ]);
    await db
      .delete(schema.projectTable)
      .where(eq(schema.projectTable.id, ctx.beta.id));
    expect(await ctx.status(ctx.viewer, `/runs/${run.id}`)).toBe(404);
    expect(await ctx.status(ctx.owner, `/runs/${run.id}`)).toBe(200);
  });

  it("merges concurrent project records without dropping or duplicating IDs", async () => {
    const ctx = await createSharedAgentWorkspace();
    const run = await ctx.insertRun((await ctx.conversation()).id);
    await Promise.all([
      recordTouchedProjects(run.id, [ctx.alpha.id, ctx.alpha.id]),
      recordTouchedProjects(run.id, [ctx.beta.id]),
    ]);
    const [recorded] = await db
      .select()
      .from(schema.agentRunTable)
      .where(eq(schema.agentRunTable.id, run.id));
    expect(recorded?.touchedProjectIds).toEqual(
      [ctx.alpha.id, ctx.beta.id].sort(),
    );
  });

  it("does not include a proposal committed after the visibility snapshot", async () => {
    const ctx = await createSharedAgentWorkspace();
    const run = await ctx.insertRun((await ctx.conversation()).id);
    const original = access.getVisibleRun;
    vi.spyOn(access, "getVisibleRun").mockImplementationOnce(
      async (...args) => {
        const visible = await original(...args);
        // A tool commits restricted project data between the access check and
        // the detail query. The response must see the earlier snapshot only.
        await db.transaction(async (tx) => {
          await recordTouchedProjects(run.id, [ctx.beta.id], tx);
          await tx.insert(schema.agentProposalTable).values({
            runId: run.id,
            action: {
              type: "comment.create",
              taskId: ctx.betaTask.id,
              body: "Private update",
            },
            reason: "Private project",
          });
        });
        return visible;
      },
    );
    const detail = await getRun(
      {
        userId: ctx.restricted.id,
        workspaceId: ctx.workspace.id,
        projectId: null,
      },
      run.id,
    );
    expect(detail.proposals).toEqual([]);
    expect(await ctx.status(ctx.restricted, `/runs/${run.id}`)).toBe(404);
  });
});

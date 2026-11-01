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
import { mockAuthenticatedSession } from "./helpers/auth";
import { createSharedAgentWorkspace } from "./helpers/agent/shared-agent-workspace";
import { resetTestDatabase } from "./helpers/database";

vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<object>()),
  publishEvent: vi.fn(async () => undefined),
}));
beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("KANEO_AGENT_ENABLED", "true");
  vi.stubEnv("OPENROUTER_API_KEY", "fake-test-key");
  vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-6-luna");
});
afterEach(() => vi.unstubAllEnvs());

const sorted = (...ids: string[]) => [...ids].sort();

describe("projects touched by agent runs", () => {
  it("records the projects whose data each tool returned", async () => {
    const ctx = await createSharedAgentWorkspace();
    const { alpha, beta } = ctx;
    const both = sorted(alpha.id, beta.id);
    const cases: Array<[string, unknown, string[]]> = [
      ["list_members", {}, []],
      ["list_projects", {}, both],
      ["get_task", { taskId: ctx.alphaTask.id }, [alpha.id]],
      ["list_tasks", { limit: 10, offset: 0 }, both],
      ["list_tasks", { projectId: beta.id, limit: 10, offset: 0 }, [beta.id]],
      [
        "workload",
        { from: "2026-01-01T00:00:00Z", to: "2027-01-01T00:00:00Z" },
        both,
      ],
      [
        "propose_change",
        {
          action: {
            type: "task.create",
            projectId: beta.id,
            title: "Prepare release",
            status: "to-do",
            priority: "medium",
          },
          reason: "Release planning",
        },
        [beta.id],
      ],
      [
        "propose_change",
        {
          action: {
            type: "task.update",
            taskId: ctx.betaTask.id,
            patch: { title: "Updated release plan" },
          },
          reason: "Clarify scope",
        },
        [beta.id],
      ],
      [
        "propose_change",
        {
          action: {
            type: "comment.create",
            taskId: ctx.betaTask.id,
            body: "Any update?",
          },
          reason: "Stale",
        },
        [beta.id],
      ],
    ];
    for (const [toolName, input, expected] of cases) {
      const run = await ctx.execute(await ctx.conversation(), [
        { toolName, input },
      ]);
      expect([toolName, run.touchedProjectIds]).toEqual([toolName, expected]);
    }
  });

  it("inherits earlier turns and adds mentioned items and the conversation project", async () => {
    const ctx = await createSharedAgentWorkspace();
    const thread = await ctx.conversation();
    await ctx.execute(thread, [
      { toolName: "get_task", input: { taskId: ctx.alphaTask.id } },
    ]);
    const next = await ctx.execute(
      thread,
      [],
      `Compare with @[Beta](project:${ctx.beta.id})`,
    );
    expect(next.touchedProjectIds).toEqual(sorted(ctx.alpha.id, ctx.beta.id));

    const taskMention = await ctx.execute(
      await ctx.conversation(),
      [],
      `Review @[Beta task](task:${ctx.betaTask.id})`,
    );
    expect(taskMention.touchedProjectIds).toEqual([ctx.beta.id]);

    const scoped = await ctx.execute(await ctx.conversation(ctx.beta.id), []);
    expect(scoped.touchedProjectIds).toEqual([ctx.beta.id]);
  });

  it("hides a shared run from members who cannot read every project it touched", async () => {
    const ctx = await createSharedAgentWorkspace();
    const thread = await ctx.conversation();
    const run = await ctx.execute(thread, [
      { toolName: "get_task", input: { taskId: ctx.betaTask.id } },
    ]);
    expect(run.touchedProjectIds).toEqual([ctx.beta.id]);
    const [attachment] = await db
      .insert(schema.agentAttachmentTable)
      .values({
        workspaceId: ctx.workspace.id,
        userId: ctx.owner.id,
        runId: run.id,
        name: "board.png",
        mediaType: "image/png",
        size: 3,
        data: Buffer.from("png"),
      })
      .returning();
    const paths = [
      `/conversations/${thread.id}`,
      `/conversations/${thread.id}/runs`,
      `/runs/${run.id}`,
      `/runs/${run.id}/events`,
      `/attachments/${attachment?.id}/content`,
    ];
    const statuses = (user: typeof ctx.owner) =>
      Promise.all(paths.map((path) => ctx.status(user, path)));

    expect(await statuses(ctx.owner)).toEqual([200, 200, 200, 200, 200]);
    expect(await statuses(ctx.viewer)).toEqual([200, 200, 200, 200, 200]);
    expect(await ctx.json(ctx.viewer, "/runs")).toEqual([
      expect.objectContaining({ id: run.id }),
    ]);
    const viewerRun = await ctx.json(ctx.viewer, `/runs/${run.id}`);
    expect(viewerRun).not.toHaveProperty("touchedProjectIds");

    expect(await statuses(ctx.restricted)).toEqual([404, 404, 404, 404, 404]);
    expect(await ctx.json(ctx.restricted, "/runs")).toEqual([]);
    mockAuthenticatedSession(ctx.restricted);
    const { app } = await import("../../apps/api/src/index").then((module) =>
      module.createApp(),
    );
    const cancel = await app.request(
      `/api/agent/${ctx.workspace.id}/runs/${run.id}/cancel`,
      { method: "POST" },
    );
    expect(cancel.status).toBe(404);
  });

  it("filters recent and conversation runs in SQL before paginating", async () => {
    const ctx = await createSharedAgentWorkspace();
    const thread = await ctx.conversation();
    const empty = await ctx.conversation();
    const at = (minute: number) => new Date(Date.UTC(2026, 9, 1, 9, minute));
    const runs = [];
    for (const [minute, project] of [
      [1, ctx.alpha.id],
      [2, ctx.beta.id],
      [3, ctx.alpha.id],
      [4, ctx.beta.id],
    ] as const)
      runs.push(
        await ctx.insertRun(thread.id, {
          createdAt: at(minute),
          touchedProjectIds: [project],
        }),
      );
    const ids = (rows: Array<{ id: string }>) => rows.map((row) => row.id);
    const [first, , third] = runs;

    expect(
      ids(await ctx.json(ctx.restricted, "/runs?limit=1&offset=0")),
    ).toEqual([third?.id]);
    expect(
      ids(await ctx.json(ctx.restricted, "/runs?limit=1&offset=1")),
    ).toEqual([first?.id]);
    expect(await ctx.json(ctx.restricted, "/runs?limit=1&offset=2")).toEqual(
      [],
    );
    expect(
      ids(await ctx.json(ctx.restricted, `/conversations/${thread.id}/runs`)),
    ).toEqual([third?.id, first?.id]);
    expect(
      ids(
        await ctx.json(
          ctx.restricted,
          `/conversations/${thread.id}/runs?limit=1&offset=1`,
        ),
      ),
    ).toEqual([first?.id]);
    // A visible run keeps the thread visible; a thread without runs shows too.
    expect(
      await ctx.status(ctx.restricted, `/conversations/${thread.id}`),
    ).toBe(200);
    expect(await ctx.status(ctx.restricted, `/conversations/${empty.id}`)).toBe(
      200,
    );
    expect(ids(await ctx.json(ctx.viewer, "/runs"))).toEqual(
      ids([...runs].reverse()),
    );
  });

  it("keeps project-scoped sharing on the conversation's project", async () => {
    const ctx = await createSharedAgentWorkspace();
    const alphaThread = await ctx.conversation(ctx.alpha.id);
    const betaThread = await ctx.conversation(ctx.beta.id);
    mockAuthenticatedSession(ctx.owner);
    const { app } = await import("../../apps/api/src/index").then((module) =>
      module.createApp(),
    );
    const created = await app.request(
      `/api/agent/${ctx.workspace.id}/conversations/${alphaThread.id}/runs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: randomUUID(), prompt: "Plan" }),
      },
    );
    expect(created.status).toBe(202);
    const { id } = await created.json();
    const [queued] = await db
      .select({ touched: schema.agentRunTable.touchedProjectIds })
      .from(schema.agentRunTable)
      .where(eq(schema.agentRunTable.id, id));
    expect(queued?.touched).toEqual([ctx.alpha.id]);

    expect(await ctx.status(ctx.restricted, `/runs/${id}`)).toBe(200);
    expect(
      await ctx.status(ctx.restricted, `/conversations/${betaThread.id}`),
    ).toBe(404);
  });
});

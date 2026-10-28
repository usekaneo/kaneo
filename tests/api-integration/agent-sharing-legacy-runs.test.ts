import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createSharedAgentWorkspace } from "./helpers/agent/shared-agent-workspace";
import { resetTestDatabase } from "./helpers/database";

beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("KANEO_AGENT_ENABLED", "true");
  vi.stubEnv("OPENROUTER_API_KEY", "fake-test-key");
  vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-6-luna");
});
afterEach(() => vi.unstubAllEnvs());

const drizzleDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../apps/api/drizzle",
);

function backfillStatement() {
  const file = readdirSync(drizzleDir).find((name) =>
    name.endsWith("_agent_run_touched_projects.sql"),
  );
  if (!file) throw new Error("touched projects migration not found");
  const statement = readFileSync(resolve(drizzleDir, file), "utf8")
    .split("--> statement-breakpoint")
    .find((part) => part.includes("UPDATE"));
  if (!statement) throw new Error("backfill statement not found");
  return statement;
}

describe("runs recorded before touched projects", () => {
  it("backfills project-scoped runs and keeps workspace-scoped ones owner-only", async () => {
    const ctx = await createSharedAgentWorkspace();
    const workspaceThread = await ctx.conversation();
    const projectThread = await ctx.conversation(ctx.alpha.id);
    const legacy = await ctx.insertRun(workspaceThread.id);
    const scoped = await ctx.insertRun(projectThread.id);
    await db.execute(sql.raw(backfillStatement()));

    const touched = await db
      .select({
        id: schema.agentRunTable.id,
        touched: schema.agentRunTable.touchedProjectIds,
      })
      .from(schema.agentRunTable);
    expect(touched).toEqual(
      expect.arrayContaining([
        { id: legacy.id, touched: ["*"] },
        { id: scoped.id, touched: [ctx.alpha.id] },
      ]),
    );

    expect(await ctx.status(ctx.owner, `/runs/${legacy.id}`)).toBe(200);
    expect(await ctx.status(ctx.viewer, `/runs/${legacy.id}`)).toBe(404);
    expect(
      await ctx.status(ctx.viewer, `/conversations/${workspaceThread.id}`),
    ).toBe(404);
    expect(await ctx.status(ctx.viewer, `/runs/${scoped.id}`)).toBe(200);
    expect(
      (await ctx.json(ctx.viewer, "/runs")).map(
        (run: { id: string }) => run.id,
      ),
    ).toEqual([scoped.id]);

    // A later turn sees the legacy answer, so it inherits the marker.
    const next = await ctx.execute(workspaceThread, []);
    expect(next.touchedProjectIds).toEqual(["*"]);
    expect(await ctx.status(ctx.viewer, `/runs/${next.id}`)).toBe(404);
  });
});

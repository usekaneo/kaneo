import { mkdir, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { processCodeJobs } from "../../apps/api/src/agent/code/process-code-jobs";
import { resetTestDatabase } from "./helpers/database";
import { createCodingGithubFixture } from "./helpers/agent-code/github-fixture";
import { createCodingHttpFixture } from "./helpers/agent-code/create-coding-http-fixture";

// Keep the transport, signature checks, database, and Git real. Only the
// coding editor and external GitHub responses are scripted fixtures.
const github = createCodingGithubFixture();

beforeEach(async () => {
  await resetTestDatabase();
  github.install();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("takes actual wrapper Git edits through HTTP callbacks and DB completion", async () => {
  const ctx = await createCodingHttpFixture(github);
  try {
    await ctx.run(async (cwd, spec, _key, signal) => {
      expect(spec.baseSha).toBe(github.baseSha);
      expect(spec.context).toContain("Fix reconnect");
      signal.throwIfAborted();
      await unlink(join(cwd, "old.txt"));
      await mkdir(join(cwd, "src"));
      await writeFile(
        join(cwd, "src/fix.ts"),
        "export const repaired = true;\n",
      );
    });
    expect(ctx.requests).toEqual(
      expect.arrayContaining([
        { path: "/api/agent-jobs/claim", status: 200 },
        { path: `/api/agent-jobs/${ctx.job.id}/heartbeat`, status: 200 },
        { path: `/api/agent-jobs/${ctx.job.id}/changeset`, status: 202 },
      ]),
    );
    expect(
      (
        await db.query.agentJobTable.findFirst({
          where: eq(schema.agentJobTable.id, ctx.job.id),
        })
      )?.status,
    ).toBe("committing");
    await processCodeJobs();
    expect(
      await db.query.agentJobTable.findFirst({
        where: eq(schema.agentJobTable.id, ctx.job.id),
      }),
    ).toMatchObject({
      status: "completed",
      outcome: "pr_opened",
      credentialHash: null,
      prNumber: 7,
    });
    expect(await db.select().from(schema.agentJobChangesetTable)).toHaveLength(
      0,
    );
    const blobs = github.calls.filter((call) =>
      call.path.endsWith("/git/blobs"),
    );
    expect(blobs).toHaveLength(1);
    expect(
      Buffer.from(String(blobs[0]?.body.content), "base64").toString(),
    ).toBe("export const repaired = true;\n");
    expect(
      github.calls.find((call) => call.path.endsWith("/git/trees"))?.body.tree,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "old.txt", sha: null }),
        expect.objectContaining({ path: "src/fix.ts", mode: "100644" }),
      ]),
    );
    expect(
      (await ctx.request(`${ctx.job.id}/heartbeat`, {}, ctx.credential)).status,
    ).toBe(410);
    expect(
      (await ctx.request("claim", { jobId: ctx.job.id }, await ctx.oidc()))
        .status,
    ).toBe(410);
  } finally {
    await ctx.close();
  }
});

it.each([
  "no_changes",
  "agent_failure",
  "ci_edit",
  "model_key_leak",
  "callback_key_leak",
  "outside_symlink",
  "permission_revoked",
])("enforces the wrapper/API boundary for %s", async (scenario) => {
  const ctx = await createCodingHttpFixture(github);
  try {
    const result = ctx.run(async (cwd) => {
      if (scenario === "agent_failure") throw new Error("private model output");
      if (scenario === "ci_edit") {
        await mkdir(join(cwd, ".github/workflows"), { recursive: true });
        await writeFile(
          join(cwd, ".github/workflows/new.yml"),
          "unsafe: yes\n",
        );
      }
      if (scenario === "model_key_leak")
        await writeFile(join(cwd, "key.txt"), "fixture-model-key");
      if (scenario === "callback_key_leak")
        await writeFile(join(cwd, "key.txt"), ctx.credential);
      if (scenario === "outside_symlink")
        await symlink(tmpdir(), join(cwd, "outside"));
      if (scenario === "permission_revoked") {
        await writeFile(join(cwd, "old.txt"), "changed\n");
        await db
          .update(schema.workspaceUserTable)
          .set({ role: "viewer" })
          .where(eq(schema.workspaceUserTable.userId, ctx.user.id));
      }
    });
    if (["no_changes", "permission_revoked"].includes(scenario)) await result;
    else await expect(result).rejects.toThrow("Kaneo coding job failed");
    await processCodeJobs();
    const row = await db.query.agentJobTable.findFirst({
      where: eq(schema.agentJobTable.id, ctx.job.id),
    });
    if (scenario === "no_changes")
      expect(row).toMatchObject({
        status: "completed",
        outcome: "no_changes",
        credentialHash: null,
      });
    else
      expect(row).toMatchObject({
        status: "failed",
        error:
          scenario === "permission_revoked" ? "access_revoked" : "agent_failed",
        credentialHash: null,
      });
    expect(await db.select().from(schema.agentJobChangesetTable)).toHaveLength(
      0,
    );
    expect(
      github.calls.some(
        (call) =>
          call.method === "POST" &&
          ["/git/blobs", "/git/refs", "/pulls"].some((suffix) =>
            call.path.endsWith(suffix),
          ),
      ),
    ).toBe(false);
    if (
      [
        "model_key_leak",
        "callback_key_leak",
        "outside_symlink",
        "agent_failure",
      ].includes(scenario)
    )
      expect(ctx.requests.some((req) => req.path.endsWith("/changeset"))).toBe(
        false,
      );
    if (scenario === "ci_edit")
      expect(ctx.requests).toContainEqual({
        path: `/api/agent-jobs/${ctx.job.id}/changeset`,
        status: 400,
      });
    expect(JSON.stringify(row)).not.toContain("private model output");
  } finally {
    await ctx.close();
  }
});

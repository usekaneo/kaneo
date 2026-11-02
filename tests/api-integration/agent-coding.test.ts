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
import { processCodeJobs } from "../../apps/api/src/agent/code/process-code-jobs";
import jobCallbacks from "../../apps/api/src/agent/code/routes/job-callbacks";
import { createAgentTools } from "../../apps/api/src/agent/tools";
import { createProposal } from "../../apps/api/src/agent/controllers/create-proposal";
import { mockAuthenticatedSession, mockAnonymousSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { createCodingGithubFixture } from "./helpers/agent-code/github-fixture";
import { createCodingFixture } from "./helpers/agent-code/create-coding-fixture";

const github = createCodingGithubFixture();
beforeEach(async () => {
  await resetTestDatabase();
  github.install();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const changes = {
  outcome: "changes",
  baseSha: github.baseSha,
  title: "Fix reconnect",
  body: "Tested the reconnect fix",
  commitMessage: "fix: reconnect",
  files: [
    {
      action: "upsert",
      path: "src/fix.ts",
      mode: "100644",
      content: Buffer.from("fixed").toString("base64"),
    },
    { action: "delete", path: "obsolete.txt" },
  ],
};

describe("repo-ci coding jobs", () => {
  it("looks up uncertain dispatches using the pinned workflow identity", async () => {
    const ctx = await createCodingFixture(github);
    const job = await (await ctx.start()).json();
    const row = await db.query.agentJobTable.findFirst({
      where: eq(schema.agentJobTable.id, job.id),
    });
    const { recoverGithubDispatch } =
      await import("../../apps/api/src/agent/code/backends/recover-github-dispatch");
    await expect(
      recoverGithubDispatch({ ...row!, workflowSha: github.baseSha }),
    ).resolves.toBe(null);
    github.visibleRuns = [
      ...Array.from({ length: 100 }, (_, i) => ({
        id: i + 1000,
        display_title: `Other job ${i}`,
        head_sha: github.baseSha,
      })),
      {
        id: 123,
        display_title: `Kaneo job ${job.id}`,
        head_sha: github.baseSha,
      },
    ];
    await expect(
      recoverGithubDispatch({ ...row!, workflowSha: github.baseSha }),
    ).resolves.toMatchObject({ externalRef: "123" });
  });

  it("requires run_code, linked GitHub write access, and project repository opt-in", async () => {
    const ctx = await createCodingFixture(github, "member");
    expect((await ctx.start()).status).toBe(403);
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "admin" })
      .where(eq(schema.workspaceUserTable.userId, ctx.user.id));
    github.permission = "read";
    expect((await ctx.start()).status).toBe(403);
    github.permission = "write";
    await db
      .update(schema.integrationTable)
      .set({
        config: JSON.stringify({
          repositoryOwner: "acme",
          repositoryName: "widget",
          installationId: 11,
        }),
      })
      .where(eq(schema.integrationTable.id, ctx.integration.id));
    expect((await ctx.start()).status).toBe(404);
    expect(github.dispatches).toBe(0);
  });
  it("dispatches, claims once, creates a multi-file commit and draft PR, links the task, and deletes credentials/bytes", async () => {
    const ctx = await createCodingFixture(github);
    const response = await ctx.start();
    expect(response.status).toBe(202);
    const job = await response.json();
    expect(
      (
        await db.query.agentRunTable.findFirst({
          where: eq(schema.agentRunTable.id, job.runId),
        })
      )?.touchedProjectIds,
    ).toEqual([ctx.project.id]);
    expect(await (await ctx.start()).json()).toMatchObject({ id: job.id });
    await processCodeJobs();
    expect(github.calls).toContainEqual(
      expect.objectContaining({
        method: "POST",
        path: "/repos/acme/widget/actions/workflows/kaneo-agent.yml/dispatches",
        body: {
          ref: "main",
          inputs: { job: job.id },
          return_run_details: true,
        },
      }),
    );
    mockAnonymousSession(); // Callback identity is independent of Kaneo sessions.
    const claimed = await ctx.post(
      "/api/agent-jobs/claim",
      { jobId: job.id },
      await ctx.oidc(),
    );
    expect(claimed.status).toBe(200);
    const claim = await claimed.json();
    expect(claim.spec.context).toContain("Fix reconnect");
    expect(claim.spec).toMatchObject({
      baseSha: github.baseSha,
      instructions: "Fix reconnect",
    });
    expect(
      (
        await ctx.post(
          "/api/agent-jobs/claim",
          { jobId: job.id },
          await ctx.oidc(),
        )
      ).status,
    ).toBe(410);
    expect(
      (
        await ctx.post(
          `/api/agent-jobs/${job.id}/heartbeat`,
          { phase: "working" },
          "wrong",
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await ctx.post(
          `/api/agent-jobs/${job.id}/changeset`,
          changes,
          claim.credential,
        )
      ).status,
    ).toBe(202);
    expect(
      (
        await ctx.post(
          `/api/agent-jobs/${job.id}/changeset`,
          changes,
          claim.credential,
        )
      ).status,
    ).toBe(410);
    mockAuthenticatedSession(ctx.user);
    await processCodeJobs();
    const result = await (
      await ctx.app.request(`${ctx.base}/jobs/${job.id}`)
    ).json();
    expect(result).toMatchObject({
      status: "completed",
      outcome: "pr_opened",
      prNumber: 7,
      prUrl: "https://github.com/acme/widget/pull/7",
    });
    const prCall = github.calls.find(
      (call) => call.path.endsWith("/pulls") && call.method === "POST",
    );
    expect(prCall?.body).toMatchObject({
      draft: true,
      base: "main",
      title: `${ctx.project.slug.toUpperCase()}-135: Fix reconnect`,
    });
    const links = await db.select().from(schema.externalLinkTable);
    expect(links).toContainEqual(
      expect.objectContaining({
        taskId: ctx.task.id,
        externalId: "7",
        resourceType: "pull_request",
      }),
    );
    const record = await db.query.agentJobTable.findFirst({
      where: eq(schema.agentJobTable.id, job.id),
    });
    expect(record?.credentialHash).toBeNull();
    expect(await db.select().from(schema.agentJobChangesetTable)).toHaveLength(
      0,
    );
    expect(JSON.stringify(result)).not.toMatch(
      /credentialHash|fake-installation-token|fake-model-key/,
    );
    const run = await (
      await ctx.app.request(`${ctx.base}/runs/${job.runId}`)
    ).json();
    expect(run.jobs).toHaveLength(1);
    const events = await (
      await ctx.app.request(`${ctx.base}/jobs/${job.id}/events?after=0`)
    ).json();
    expect(events.map((event: { phase: string }) => event.phase)).toEqual([
      "queued",
      "dispatched",
      "running",
      "committing",
      "completed",
    ]);
    expect(github.dispatches).toBe(1);
  });
  it.each([false, true])(
    "links only the approved task across ambiguous repositories (unnumbered: %s)",
    async (unnumbered) => {
      const ctx = await createCodingFixture(github);
      const other = await createCodingFixture(github);
      await db
        .update(schema.projectTable)
        .set({ slug: ctx.project.slug })
        .where(eq(schema.projectTable.id, other.project.id));
      if (unnumbered) {
        await db
          .update(schema.taskTable)
          .set({ number: null })
          .where(eq(schema.taskTable.id, ctx.task.id));
        await db.insert(schema.taskTable).values({
          projectId: ctx.project.id,
          number: 135,
          title: "A different task",
        });
      }
      mockAuthenticatedSession(ctx.user);
      const job = await (await ctx.start()).json();
      await processCodeJobs();
      const claim = await (
        await ctx.post(
          "/api/agent-jobs/claim",
          { jobId: job.id },
          await ctx.oidc(),
        )
      ).json();
      await ctx.post(
        `/api/agent-jobs/${job.id}/changeset`,
        { ...changes, title: `${ctx.project.slug.toUpperCase()}-135: Fix` },
        claim.credential,
      );
      await processCodeJobs();
      expect(await db.select().from(schema.externalLinkTable)).toEqual([
        expect.objectContaining({
          taskId: ctx.task.id,
          integrationId: ctx.integration.id,
        }),
      ]);
      expect(
        (
          await db.query.agentJobTable.findFirst({
            where: eq(schema.agentJobTable.id, job.id),
          })
        )?.status,
      ).toBe("completed");
    },
  );
  it.each(["missing", "invalid", "other-job", "expired", "revoked"] as const)(
    "rejects %s credentials before reading changeset bytes",
    async (kind) => {
      const ctx = await createCodingFixture(github);
      const job = await (await ctx.start()).json();
      await processCodeJobs();
      const claim = await (
        await ctx.post(
          "/api/agent-jobs/claim",
          { jobId: job.id },
          await ctx.oidc(),
        )
      ).json();
      if (kind === "expired")
        await db
          .update(schema.agentJobTable)
          .set({ deadline: new Date(0) })
          .where(eq(schema.agentJobTable.id, job.id));
      if (kind === "revoked")
        expect((await ctx.post(`/jobs/${job.id}/cancel`)).status).toBe(200);
      mockAnonymousSession();
      const pull = vi.fn();
      const body = new ReadableStream({ pull }, { highWaterMark: 0 });
      const jobId = kind === "other-job" ? "other-job" : job.id;
      const token = kind === "invalid" ? "wrong-token" : claim.credential;
      const request = new Request(`http://localhost/${jobId}/changeset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(kind === "missing" ? {} : { Authorization: `Bearer ${token}` }),
        },
        body,
        duplex: "half",
      } as RequestInit);
      try {
        // Test the callback router directly: client-IP header forwarding in the
        // outer app transfers streams and can prefetch a chunk on Node.
        const response = await jobCallbacks.request(request);
        expect(response.status).toBe(
          kind === "missing" || kind === "invalid" ? 403 : 410,
        );
        expect(pull).not.toHaveBeenCalled();
        expect(request.bodyUsed).toBe(false);
        expect(
          await db.select().from(schema.agentJobChangesetTable),
        ).toHaveLength(0);
      } finally {
        await body.cancel();
      }
    },
  );

  it("rechecks changeset credentials when they are revoked during the body read", async () => {
    const ctx = await createCodingFixture(github);
    const job = await (await ctx.start()).json();
    await processCodeJobs();
    const claim = await (
      await ctx.post(
        "/api/agent-jobs/claim",
        { jobId: job.id },
        await ctx.oidc(),
      )
    ).json();
    mockAnonymousSession();
    const response = await ctx.app.request(
      new Request(`http://localhost/api/agent-jobs/${job.id}/changeset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${claim.credential}`,
        },
        body: new ReadableStream(
          {
            async pull(controller) {
              await db
                .update(schema.agentJobTable)
                .set({ credentialHash: null })
                .where(eq(schema.agentJobTable.id, job.id));
              controller.enqueue(
                new TextEncoder().encode(JSON.stringify(changes)),
              );
              controller.close();
            },
          },
          { highWaterMark: 0 },
        ),
        duplex: "half",
      } as RequestInit),
    );
    expect(response.status).toBe(410);
    expect(await db.select().from(schema.agentJobChangesetTable)).toHaveLength(
      0,
    );
  });

  it("rejects wrong repository/run claims, workflow edits, and cross-job credentials; cancellation revokes callbacks", async () => {
    const ctx = await createCodingFixture(github);
    const job = await (await ctx.start()).json();
    await processCodeJobs();
    for (const extra of [{ repository: "other/repo" }, { run_id: "999" }])
      expect(
        (
          await ctx.post(
            "/api/agent-jobs/claim",
            { jobId: job.id },
            await ctx.oidc(extra),
          )
        ).status,
      ).toBe(403);
    const claim = await (
      await ctx.post(
        "/api/agent-jobs/claim",
        { jobId: job.id },
        await ctx.oidc(),
      )
    ).json();
    expect(
      (
        await ctx.post(
          `/api/agent-jobs/${job.id}/changeset`,
          {
            ...changes,
            files: [
              { ...changes.files[0], path: ".github/workflows/evil.yml" },
            ],
          },
          claim.credential,
        )
      ).status,
    ).toBe(400);
    expect(
      (await ctx.post(`/api/agent-jobs/other/heartbeat`, {}, claim.credential))
        .status,
    ).toBe(410);
    expect((await ctx.post(`/jobs/${job.id}/cancel`)).status).toBe(200);
    expect(
      (
        await ctx.post(
          `/api/agent-jobs/${job.id}/changeset`,
          changes,
          claim.credential,
        )
      ).status,
    ).toBe(410);
    expect(github.calls).toContainEqual(
      expect.objectContaining({
        path: "/repos/acme/widget/actions/runs/123/cancel",
      }),
    );
  });
  it("keeps repository opt-in behind workspace settings permission and rejects conflicting starts", async () => {
    const ctx = await createCodingFixture(github);
    const update = () =>
      ctx.app.request(`/api/github-integration/project/${ctx.project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codingAgentEnabled: false }),
      });
    expect((await update()).status).toBe(200);
    expect((await ctx.start()).status).toBe(404);
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "member" })
      .where(eq(schema.workspaceUserTable.userId, ctx.user.id));
    expect((await update()).status).toBe(403);
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "admin" })
      .where(eq(schema.workspaceUserTable.userId, ctx.user.id));
    await ctx.app.request(`/api/github-integration/project/${ctx.project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codingAgentEnabled: true }),
    });
    expect((await ctx.start()).status).toBe(202);
    expect(
      (await ctx.post("/jobs", { ...ctx.input, instructions: "Different" }))
        .status,
    ).toBe(409);
    expect(
      (await ctx.post("/jobs", { ...ctx.input, requestId: randomUUID() }))
        .status,
    ).toBe(429);
  });
  it("completes no-change results and allows shared reads but owner-only cancellation", async () => {
    const ctx = await createCodingFixture(github);
    const job = await (await ctx.start()).json();
    await processCodeJobs();
    const row = await db.query.agentRunTable.findFirst({
      where: eq(schema.agentRunTable.id, job.runId),
    });
    await db
      .update(schema.agentConversationTable)
      .set({ sharedAt: new Date() })
      .where(eq(schema.agentConversationTable.id, row!.conversationId));
    const other = await createWorkspaceMember({ role: "admin" });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ctx.workspace.id,
      userId: other.user.id,
      role: "admin",
      joinedAt: new Date(),
    });
    mockAuthenticatedSession(other.user);
    expect((await ctx.app.request(`${ctx.base}/jobs/${job.id}`)).status).toBe(
      200,
    );
    expect((await ctx.post(`/jobs/${job.id}/cancel`)).status).toBe(403);
    const claim = await (
      await ctx.post(
        "/api/agent-jobs/claim",
        { jobId: job.id },
        await ctx.oidc(),
      )
    ).json();
    expect(
      (
        await ctx.post(
          `/api/agent-jobs/${job.id}/changeset`,
          { outcome: "no_changes", summary: "No changes" },
          claim.credential,
        )
      ).status,
    ).toBe(202);
    expect(
      await (await ctx.app.request(`${ctx.base}/jobs/${job.id}`)).json(),
    ).toMatchObject({ status: "completed", outcome: "no_changes" });
    expect(github.calls.some((call) => call.path.endsWith("/git/refs"))).toBe(
      false,
    );
  });
  it("records projects returned by coding repository discovery", async () => {
    const ctx = await createCodingFixture(github);
    const conversation = await (await ctx.post("/conversations", {})).json();
    const run = await (
      await ctx.post(`/conversations/${conversation.id}/runs`, {
        requestId: randomUUID(),
        prompt: "Find repositories",
      })
    ).json();
    const lease = randomUUID();
    await db
      .update(schema.agentRunTable)
      .set({
        status: "running",
        leaseOwner: lease,
        leaseExpiresAt: new Date(Date.now() + 60000),
      })
      .where(eq(schema.agentRunTable.id, run.id));
    const tools = createAgentTools(
      { userId: ctx.user.id, workspaceId: ctx.workspace.id, projectId: null },
      run.id,
      lease,
      new AbortController().signal,
      () => {},
    );
    expect(
      await tools.list_code_repositories!.execute!(
        {},
        { toolCallId: "repositories", messages: [], abortSignal: undefined },
      ),
    ).toMatchObject([{ projectId: ctx.project.id, state: "ready" }]);
    expect(
      (
        await db.query.agentRunTable.findFirst({
          where: eq(schema.agentRunTable.id, run.id),
        })
      )?.touchedProjectIds,
    ).toEqual([ctx.project.id]);
  });
  it("starts only after applying a code.run proposal, once", async () => {
    const ctx = await createCodingFixture(github);
    const conversation = await (await ctx.post("/conversations", {})).json();
    const run = await (
      await ctx.post(`/conversations/${conversation.id}/runs`, {
        requestId: randomUUID(),
        prompt: "Fix task",
      })
    ).json();
    const owner = randomUUID();
    await db
      .update(schema.agentRunTable)
      .set({
        status: "running",
        leaseOwner: owner,
        leaseExpiresAt: new Date(Date.now() + 60000),
      })
      .where(eq(schema.agentRunTable.id, run.id));
    const proposal = await createProposal(
      {
        userId: ctx.user.id,
        workspaceId: ctx.workspace.id,
        projectId: null,
      },
      run.id,
      {
        action: {
          type: "code.run",
          taskId: ctx.task.id,
          integrationId: ctx.integration.id,
          instructions: "Fix reconnect",
        },
        reason: "Fix",
      },
      owner,
    );
    expect(
      (
        await db.query.agentRunTable.findFirst({
          where: eq(schema.agentRunTable.id, run.id),
        })
      )?.touchedProjectIds,
    ).toEqual([ctx.project.id]);
    expect(await db.select().from(schema.agentJobTable)).toHaveLength(0);
    await db
      .update(schema.agentRunTable)
      .set({ status: "awaiting_review" })
      .where(eq(schema.agentRunTable.id, run.id));
    for (let i = 0; i < 2; i++)
      expect(
        await (
          await ctx.post(`/runs/${run.id}/apply`, {
            proposalIds: [proposal.id],
          })
        ).json(),
      ).toMatchObject({ results: [{ status: "applied" }] });
    expect(await db.select().from(schema.agentJobTable)).toHaveLength(1);
  });
  it("retries PR creation with the same branch and commit, and refuses cancelling while committing", async () => {
    const ctx = await createCodingFixture(github);
    const job = await (await ctx.start()).json();
    await processCodeJobs();
    const claim = await (
      await ctx.post(
        "/api/agent-jobs/claim",
        { jobId: job.id },
        await ctx.oidc(),
      )
    ).json();
    await ctx.post(
      `/api/agent-jobs/${job.id}/changeset`,
      changes,
      claim.credential,
    );
    expect((await ctx.post(`/jobs/${job.id}/cancel`)).status).toBe(409);
    github.rejectPrOnce = true;
    await processCodeJobs();
    await db
      .update(schema.agentJobTable)
      .set({ leaseExpiresAt: new Date(0) })
      .where(eq(schema.agentJobTable.id, job.id));
    await processCodeJobs();
    expect(
      github.calls.filter(
        (call) => call.path.endsWith("/git/commits") && call.method === "POST",
      ),
    ).toHaveLength(1);
    expect(
      (
        await db.query.agentJobTable.findFirst({
          where: eq(schema.agentJobTable.id, job.id),
        })
      )?.status,
    ).toBe("completed");
  });
  it("resets retries after healthy CI observations and reconciles a lost runner", async () => {
    const ctx = await createCodingFixture(github);
    const job = await (await ctx.start()).json();
    await processCodeJobs();
    await ctx.post(
      "/api/agent-jobs/claim",
      { jobId: job.id },
      await ctx.oidc(),
    );
    await db
      .update(schema.agentJobTable)
      .set({ attempts: 100, leaseExpiresAt: new Date(0) })
      .where(eq(schema.agentJobTable.id, job.id));
    await processCodeJobs();
    expect(
      (
        await db.query.agentJobTable.findFirst({
          where: eq(schema.agentJobTable.id, job.id),
        })
      )?.attempts,
    ).toBe(0);
    github.ciCompleted = true;
    await db
      .update(schema.agentJobTable)
      .set({ leaseExpiresAt: new Date(0) })
      .where(eq(schema.agentJobTable.id, job.id));
    await processCodeJobs();
    expect(
      await db.query.agentJobTable.findFirst({
        where: eq(schema.agentJobTable.id, job.id),
      }),
    ).toMatchObject({
      status: "failed",
      error: "ci_run_failed",
      credentialHash: null,
    });
  });
  it("preserves a third-attempt job during worker shutdown", async () => {
    const ctx = await createCodingFixture(github);
    const job = await (await ctx.start()).json();
    await db
      .update(schema.agentJobTable)
      .set({ attempts: 2 })
      .where(eq(schema.agentJobTable.id, job.id));
    const shutdown = new AbortController();
    github.abortDispatch = shutdown;
    await processCodeJobs(shutdown.signal);
    expect(
      await db.query.agentJobTable.findFirst({
        where: eq(schema.agentJobTable.id, job.id),
      }),
    ).toMatchObject({
      status: "queued",
      attempts: 2,
      leaseOwner: null,
      error: null,
    });
  });
  it("recovers an accepted third dispatch whose response was lost without relaunching it", async () => {
    const ctx = await createCodingFixture(github);
    const job = await (await ctx.start()).json();
    await db
      .update(schema.agentJobTable)
      .set({ attempts: 2 })
      .where(eq(schema.agentJobTable.id, job.id));
    github.loseDispatchReply = true;
    await processCodeJobs();
    expect(
      await db.query.agentJobTable.findFirst({
        where: eq(schema.agentJobTable.id, job.id),
      }),
    ).toMatchObject({ status: "queued", attempts: 2, error: null });
    github.visibleRuns = [
      {
        id: 123,
        display_title: `Kaneo job ${job.id}`,
        head_sha: github.baseSha,
      },
    ];
    await db
      .update(schema.agentJobTable)
      .set({ leaseExpiresAt: new Date(0) })
      .where(eq(schema.agentJobTable.id, job.id));
    await processCodeJobs();
    expect(
      await db.query.agentJobTable.findFirst({
        where: eq(schema.agentJobTable.id, job.id),
      }),
    ).toMatchObject({ status: "dispatched", externalRef: "123", attempts: 0 });
    expect(github.dispatches).toBe(1);
  });
  it("finds and cancels an uncertain dispatch before failing an expired job", async () => {
    const ctx = await createCodingFixture(github);
    const job = await (await ctx.start()).json();
    github.loseDispatchReply = true;
    await processCodeJobs();
    github.visibleRuns = [
      {
        id: 123,
        display_title: `Kaneo job ${job.id}`,
        head_sha: github.baseSha,
      },
    ];
    await db
      .update(schema.agentJobTable)
      .set({ deadline: new Date(0), leaseExpiresAt: new Date(0) })
      .where(eq(schema.agentJobTable.id, job.id));
    github.rejectCancelOnce = true;
    await processCodeJobs();
    expect(
      await db.query.agentJobTable.findFirst({
        where: eq(schema.agentJobTable.id, job.id),
      }),
    ).toMatchObject({ status: "queued", externalRef: "123" });
    await db
      .update(schema.agentJobTable)
      .set({ leaseExpiresAt: new Date(0) })
      .where(eq(schema.agentJobTable.id, job.id));
    await processCodeJobs();
    expect(
      await db.query.agentJobTable.findFirst({
        where: eq(schema.agentJobTable.id, job.id),
      }),
    ).toMatchObject({
      status: "failed",
      error: "timed_out",
      externalRef: "123",
    });
    expect(
      github.calls.some((call) =>
        call.path.endsWith("/actions/runs/123/cancel"),
      ),
    ).toBe(true);
    expect(github.dispatches).toBe(1);
  });
  it("expires stale jobs and keeps private jobs hidden from other workspace admins", async () => {
    const ctx = await createCodingFixture(github);
    const job = await (await ctx.start()).json();
    await processCodeJobs();
    const other = await createWorkspaceMember({ role: "admin" });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: ctx.workspace.id,
      userId: other.user.id,
      role: "admin",
      joinedAt: new Date(),
    });
    mockAuthenticatedSession(other.user);
    expect((await ctx.app.request(`${ctx.base}/jobs/${job.id}`)).status).toBe(
      404,
    );
    await db
      .update(schema.agentJobTable)
      .set({ deadline: new Date(0), leaseExpiresAt: new Date(0) })
      .where(eq(schema.agentJobTable.id, job.id));
    await processCodeJobs();
    expect(
      (
        await db.query.agentJobTable.findFirst({
          where: eq(schema.agentJobTable.id, job.id),
        })
      )?.error,
    ).toBe("timed_out");
  });
});

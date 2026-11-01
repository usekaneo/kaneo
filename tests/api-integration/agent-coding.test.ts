import { generateKeyPairSync, randomUUID } from "node:crypto";
import { exportJWK, SignJWT } from "jose";
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
import { createApp } from "../../apps/api/src/index";
import { processCodeJobs } from "../../apps/api/src/agent/code/process-code-jobs";
import jobCallbacks from "../../apps/api/src/agent/code/routes/job-callbacks";
import { createAgentTools } from "../../apps/api/src/agent/tools";
import { createProposal } from "../../apps/api/src/agent/controllers/create-proposal";
import { mockAuthenticatedSession, mockAnonymousSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const baseSha = "a".repeat(40);
const commitSha = "c".repeat(40);
let permission = "write";
let branchSha: string | undefined;
let pulls: Record<string, unknown>[] = [];
let calls: { method: string; path: string; body: Record<string, unknown> }[] =
  [];
let dispatches = 0;
let rejectPrOnce = false;
let ciCompleted = false;
let abortDispatch: AbortController | undefined;
let loseDispatchReply = false;
let rejectCancelOnce = false;
let visibleRuns: { id: number; display_title: string; head_sha: string }[] = [];
const json = (data: unknown, status = 200) => Response.json(data, { status });

beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("KANEO_AGENT_ENABLED", "true");
  vi.stubEnv("OPENROUTER_API_KEY", "fake-model-key");
  vi.stubEnv("KANEO_AGENT_GITHUB_APP_ID", "90001");
  vi.stubEnv(
    "KANEO_AGENT_GITHUB_APP_PRIVATE_KEY",
    keys.privateKey.export({ type: "pkcs1", format: "pem" }).toString(),
  );
  permission = "write";
  branchSha = undefined;
  pulls = [];
  calls = [];
  dispatches = 0;
  rejectPrOnce = false;
  ciCompleted = false;
  abortDispatch = undefined;
  loseDispatchReply = false;
  rejectCancelOnce = false;
  visibleRuns = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string" || input instanceof URL ? input : input.url,
      );
      if (url.origin === "https://token.actions.githubusercontent.com")
        return json({
          keys: [
            {
              ...(await exportJWK(keys.publicKey)),
              kid: "coding-test",
              alg: "RS256",
            },
          ],
        });
      if (url.origin !== "https://api.github.com")
        throw new Error(`Unexpected outbound request: ${url.origin}`);
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      calls.push({ method, path: url.pathname, body });
      const path = decodeURIComponent(url.pathname);
      if (path === "/repos/acme/widget/installation")
        return json({
          id: 22,
          permissions: {
            contents: "write",
            pull_requests: "write",
            actions: "write",
          },
        });
      if (path === "/app/installations/22/access_tokens")
        return json(
          {
            token: "fake-installation-token",
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            permissions: {
              contents: "write",
              pull_requests: "write",
              actions: "write",
            },
          },
          201,
        );
      if (path === "/repos/acme/widget")
        return json({
          id: 42,
          owner: { login: "acme" },
          name: "widget",
          default_branch: "main",
        });
      if (path === "/user/1001") return json({ id: 1001, login: "maintainer" });
      if (path.endsWith("/collaborators/maintainer/permission"))
        return json({ permission });
      if (path.endsWith("/branches/main"))
        return json({ name: "main", commit: { sha: baseSha } });
      if (path.endsWith("/actions/workflows/kaneo-agent.yml/runs"))
        return json({
          total_count: visibleRuns.length,
          workflow_runs: visibleRuns.slice(
            (Number(url.searchParams.get("page") ?? 1) - 1) * 100,
            Number(url.searchParams.get("page") ?? 1) * 100,
          ),
        });
      if (path.endsWith("/actions/workflows/kaneo-agent.yml/dispatches")) {
        dispatches++;
        if (abortDispatch) {
          abortDispatch.abort();
          throw new Error("shutdown while dispatching");
        }
        if (loseDispatchReply)
          throw new Error("dispatch accepted but response lost");
        return json({
          workflow_run_id: 123,
          html_url: "https://github.com/acme/widget/actions/runs/123",
        });
      }
      if (path.endsWith("/actions/workflows/kaneo-agent.yml"))
        return json({ state: "active" });
      if (path.endsWith("/actions/runs/123/cancel")) {
        if (rejectCancelOnce) {
          rejectCancelOnce = false;
          return json({ message: "temporary cancellation failure" }, 503);
        }
        return new Response(null, { status: 202 });
      }
      if (path.endsWith("/actions/runs/123"))
        return json({ status: ciCompleted ? "completed" : "in_progress" });
      if (path.endsWith(`/git/commits/${baseSha}`))
        return json({ tree: { sha: "tree-base" } });
      if (path.endsWith("/git/blobs")) return json({ sha: "blob" }, 201);
      if (path.endsWith("/git/trees")) return json({ sha: "tree-new" }, 201);
      if (path.endsWith("/git/commits")) return json({ sha: commitSha }, 201);
      if (path.includes("/git/ref/heads/"))
        return branchSha
          ? json({ object: { sha: branchSha } })
          : json({ message: "Not Found" }, 404);
      if (path.endsWith("/git/refs")) {
        branchSha = String(body.sha);
        return json({ object: { sha: branchSha } }, 201);
      }
      if (path.endsWith("/pulls") && method === "GET") return json(pulls);
      if (path.endsWith("/pulls") && method === "POST") {
        if (rejectPrOnce) {
          rejectPrOnce = false;
          return json({ message: "temporary" }, 503);
        }
        const pr = {
          number: 7,
          title: body.title,
          body: body.body,
          html_url: "https://github.com/acme/widget/pull/7",
          state: "open",
          draft: body.draft,
          head: { sha: commitSha, ref: body.head },
          base: { ref: body.base },
          user: { login: "kaneo-agent[bot]" },
        };
        pulls.push(pr);
        return json(pr, 201);
      }
      throw new Error(`Unexpected GitHub request: ${method} ${path}`);
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function setup(role = "admin") {
  const { user, workspace } = await createWorkspaceMember({ role });
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Fix reconnect",
      number: 135,
      columnId: columns.todo.id,
    })
    .returning();
  await db.insert(schema.accountTable).values({
    id: randomUUID(),
    userId: user.id,
    providerId: "github",
    accountId: "1001",
  });
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: "github",
      config: JSON.stringify({
        repositoryOwner: "acme",
        repositoryName: "widget",
        repositoryId: 42,
        installationId: 11,
        verifiedByUserId: user.id,
        verifiedGithubAccountId: "1001",
        codingAgent: { enabled: true },
        branchPattern: "{slug}-{number}",
      }),
    })
    .returning();
  mockAuthenticatedSession(user);
  const { app } = createApp();
  const base = `/api/agent/${workspace.id}`;
  const post = (path: string, body: unknown = {}, token?: string) =>
    app.request(path.startsWith("/api/") ? path : `${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  const input = {
    requestId: randomUUID(),
    taskId: task!.id,
    integrationId: integration!.id,
    instructions: "Fix reconnect",
  };
  const start = () => post("/jobs", input);
  const oidc = (extra: Record<string, unknown> = {}) =>
    new SignJWT({
      repository: "acme/widget",
      repository_id: "42",
      run_id: "123",
      run_attempt: "1",
      event_name: "workflow_dispatch",
      workflow_ref:
        "acme/widget/.github/workflows/kaneo-agent.yml@refs/heads/main",
      workflow_sha: baseSha,
      ...extra,
    })
      .setProtectedHeader({ alg: "RS256", kid: "coding-test" })
      .setIssuer("https://token.actions.githubusercontent.com")
      .setAudience("http://localhost:1337")
      .setSubject("repo:acme/widget:ref:refs/heads/main")
      .setJti(randomUUID())
      .setIssuedAt()
      .setNotBefore("0s")
      .setExpirationTime("5m")
      .sign(keys.privateKey);
  return {
    user,
    workspace,
    project,
    task: task!,
    integration: integration!,
    app,
    base,
    post,
    start,
    input,
    oidc,
  };
}
const changes = {
  outcome: "changes",
  baseSha,
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
    const ctx = await setup();
    const job = await (await ctx.start()).json();
    const row = await db.query.agentJobTable.findFirst({
      where: eq(schema.agentJobTable.id, job.id),
    });
    const { recoverGithubDispatch } =
      await import("../../apps/api/src/agent/code/backends/recover-github-dispatch");
    await expect(
      recoverGithubDispatch({ ...row!, workflowSha: baseSha }),
    ).resolves.toBe(null);
    visibleRuns = [
      ...Array.from({ length: 100 }, (_, i) => ({
        id: i + 1000,
        display_title: `Other job ${i}`,
        head_sha: baseSha,
      })),
      { id: 123, display_title: `Kaneo job ${job.id}`, head_sha: baseSha },
    ];
    await expect(
      recoverGithubDispatch({ ...row!, workflowSha: baseSha }),
    ).resolves.toMatchObject({ externalRef: "123" });
  });

  it("requires run_code, linked GitHub write access, and project repository opt-in", async () => {
    const ctx = await setup("member");
    expect((await ctx.start()).status).toBe(403);
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "admin" })
      .where(eq(schema.workspaceUserTable.userId, ctx.user.id));
    permission = "read";
    expect((await ctx.start()).status).toBe(403);
    permission = "write";
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
    expect(dispatches).toBe(0);
  });
  it("dispatches, claims once, creates a multi-file commit and draft PR, links the task, and deletes credentials/bytes", async () => {
    const ctx = await setup();
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
    expect(calls).toContainEqual(
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
      baseSha,
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
    const prCall = calls.find(
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
    expect(dispatches).toBe(1);
  });
  it.each([false, true])(
    "links only the approved task across ambiguous repositories (unnumbered: %s)",
    async (unnumbered) => {
      const ctx = await setup();
      const other = await setup();
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
      const ctx = await setup();
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
    const ctx = await setup();
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
    const ctx = await setup();
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
    expect(calls).toContainEqual(
      expect.objectContaining({
        path: "/repos/acme/widget/actions/runs/123/cancel",
      }),
    );
  });
  it("keeps repository opt-in behind workspace settings permission and rejects conflicting starts", async () => {
    const ctx = await setup();
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
    const ctx = await setup();
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
    expect(calls.some((call) => call.path.endsWith("/git/refs"))).toBe(false);
  });
  it("records projects returned by coding repository discovery", async () => {
    const ctx = await setup();
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
    const ctx = await setup();
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
    const ctx = await setup();
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
    rejectPrOnce = true;
    await processCodeJobs();
    await db
      .update(schema.agentJobTable)
      .set({ leaseExpiresAt: new Date(0) })
      .where(eq(schema.agentJobTable.id, job.id));
    await processCodeJobs();
    expect(
      calls.filter(
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
    const ctx = await setup();
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
    ciCompleted = true;
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
    const ctx = await setup();
    const job = await (await ctx.start()).json();
    await db
      .update(schema.agentJobTable)
      .set({ attempts: 2 })
      .where(eq(schema.agentJobTable.id, job.id));
    const shutdown = new AbortController();
    abortDispatch = shutdown;
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
    const ctx = await setup();
    const job = await (await ctx.start()).json();
    await db
      .update(schema.agentJobTable)
      .set({ attempts: 2 })
      .where(eq(schema.agentJobTable.id, job.id));
    loseDispatchReply = true;
    await processCodeJobs();
    expect(
      await db.query.agentJobTable.findFirst({
        where: eq(schema.agentJobTable.id, job.id),
      }),
    ).toMatchObject({ status: "queued", attempts: 2, error: null });
    visibleRuns = [
      { id: 123, display_title: `Kaneo job ${job.id}`, head_sha: baseSha },
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
    expect(dispatches).toBe(1);
  });
  it("finds and cancels an uncertain dispatch before failing an expired job", async () => {
    const ctx = await setup();
    const job = await (await ctx.start()).json();
    loseDispatchReply = true;
    await processCodeJobs();
    visibleRuns = [
      { id: 123, display_title: `Kaneo job ${job.id}`, head_sha: baseSha },
    ];
    await db
      .update(schema.agentJobTable)
      .set({ deadline: new Date(0), leaseExpiresAt: new Date(0) })
      .where(eq(schema.agentJobTable.id, job.id));
    rejectCancelOnce = true;
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
      calls.some((call) => call.path.endsWith("/actions/runs/123/cancel")),
    ).toBe(true);
    expect(dispatches).toBe(1);
  });
  it("expires stale jobs and keeps private jobs hidden from other workspace admins", async () => {
    const ctx = await setup();
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

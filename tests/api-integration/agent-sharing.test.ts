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
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

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

const png = Buffer.from("\x89PNG\r\n\x1a\nimage-bytes", "latin1");

async function addMember(
  workspaceId: string,
  options: { name: string; projectAccess?: "selected" },
) {
  const { user } = await createWorkspaceMember({ userName: options.name });
  await db.insert(schema.workspaceUserTable).values({
    userId: user.id,
    workspaceId,
    role: "member",
    joinedAt: new Date(),
  });
  if (options.projectAccess)
    await db.insert(schema.workspaceMemberAccessTable).values({
      workspaceId,
      userId: user.id,
      projectAccess: options.projectAccess,
    });
  return user;
}

async function setup(scope: "project" | "workspace" = "project") {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "member",
    userName: "Mira Kowalski",
  });
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.todo.id,
      title: "Fix reconnect",
      number: 1,
      priority: "low",
      status: "to-do",
    })
    .returning();
  const viewer = await addMember(workspace.id, { name: "Ada Lovelace" });
  const outsider = await addMember(workspace.id, {
    name: "Restricted Reader",
    projectAccess: "selected",
  });
  const { app } = createApp();
  const base = `/api/agent/${workspace.id}`;
  const get = (path: string) => app.request(`${base}${path}`);
  const post = (path: string, body?: unknown) =>
    app.request(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  mockAuthenticatedSession(owner);
  const conversation = await (
    await post(
      "/conversations",
      scope === "project" ? { projectId: project.id } : {},
    )
  ).json();
  const upload = await (
    await post("/attachments", {
      name: "board.png",
      mediaType: "image/png",
      data: png.toString("base64"),
    })
  ).json();
  const created = await post(`/conversations/${conversation.id}/runs`, {
    requestId: randomUUID(),
    prompt: "Rebalance this week",
    attachments: [{ id: upload.id }],
  });
  expect(created.status).toBe(202);
  const run = await created.json();
  await db
    .update(schema.agentRunTable)
    .set({ status: "awaiting_review", finishedAt: new Date() })
    .where(eq(schema.agentRunTable.id, run.id));
  const [proposal] = await db
    .insert(schema.agentProposalTable)
    .values({
      runId: run.id,
      action: {
        type: "task.update",
        taskId: task.id,
        patch: { priority: "high" },
      },
      reason: "Due soon",
    })
    .returning();

  const readPaths = [
    `/conversations/${conversation.id}`,
    `/conversations/${conversation.id}/runs`,
    `/runs/${run.id}`,
    `/attachments/${upload.id}/content`,
  ];
  const statuses = async (paths: string[]) =>
    Promise.all(paths.map(async (path) => (await get(path)).status));
  const ownerActions = () =>
    Promise.all(
      [
        post(`/conversations/${conversation.id}/runs`, {
          requestId: randomUUID(),
          prompt: "Me too",
        }),
        post(`/runs/${run.id}/cancel`),
        post(`/runs/${run.id}/apply`, { proposalIds: [proposal.id] }),
        post(`/runs/${run.id}/discard`, { proposalIds: [proposal.id] }),
        post(`/proposals/${proposal.id}/undo`),
        post(`/conversations/${conversation.id}/share`),
        post(`/conversations/${conversation.id}/unshare`),
      ].map(async (response) => (await response).status),
    );
  const as = (user: typeof owner) => mockAuthenticatedSession(user);
  return {
    owner,
    viewer,
    outsider,
    workspace,
    conversation,
    run,
    upload,
    proposal,
    get,
    post,
    as,
    readPaths,
    statuses,
    ownerActions,
  };
}

describe("agent conversation sharing", () => {
  it("keeps unshared conversations and their attachments undiscoverable", async () => {
    const ctx = await setup();
    ctx.as(ctx.viewer);
    expect(await ctx.statuses(ctx.readPaths)).toEqual([404, 404, 404, 404]);
    expect(await ctx.ownerActions()).toEqual([
      404, 404, 404, 404, 404, 404, 404,
    ]);
    expect(await (await ctx.get("/runs")).json()).toEqual([]);
  });

  it("lets members who can read the project view a shared conversation read-only", async () => {
    const ctx = await setup();
    const before = await (
      await ctx.get(`/conversations/${ctx.conversation.id}`)
    ).json();
    expect(before.sharedAt).toBeNull();
    const shared = await ctx.post(
      `/conversations/${ctx.conversation.id}/share`,
    );
    expect(shared.status).toBe(200);
    const body = await shared.json();
    expect(body.sharedAt).toEqual(expect.any(String));
    expect(body.updatedAt).toBe(before.updatedAt);
    const again = await (
      await ctx.post(`/conversations/${ctx.conversation.id}/share`)
    ).json();
    expect(again.sharedAt).toBe(body.sharedAt);

    ctx.as(ctx.viewer);
    expect(await ctx.statuses(ctx.readPaths)).toEqual([200, 200, 200, 200]);
    expect(
      await (await ctx.get(`/conversations/${ctx.conversation.id}`)).json(),
    ).toMatchObject({
      id: ctx.conversation.id,
      userId: ctx.owner.id,
      owner: { id: ctx.owner.id, name: "Mira Kowalski", image: null },
    });
    const run = await (await ctx.get(`/runs/${ctx.run.id}`)).json();
    expect(run.proposals).toHaveLength(1);
    const attachment = await ctx.get(`/attachments/${ctx.upload.id}/content`);
    expect(attachment.headers.get("Cache-Control")).toBe("private, no-store");
    expect(Buffer.from(await attachment.arrayBuffer())).toEqual(png);
    expect(await (await ctx.get("/runs")).json()).toEqual([
      expect.objectContaining({
        id: ctx.run.id,
        conversationId: ctx.conversation.id,
        shared: true,
        pendingProposals: 1,
        owner: { id: ctx.owner.id, name: "Mira Kowalski", image: null },
      }),
    ]);
    // History stays your own conversations.
    expect(await (await ctx.get("/conversations")).json()).toEqual([]);

    expect(await ctx.ownerActions()).toEqual([
      403, 403, 403, 403, 403, 403, 403,
    ]);
    const [proposal] = await db
      .select({ status: schema.agentProposalTable.status })
      .from(schema.agentProposalTable)
      .where(eq(schema.agentProposalTable.id, ctx.proposal.id));
    expect(proposal?.status).toBe("pending");
  });

  it("hides shared project conversations from members without project access", async () => {
    const ctx = await setup();
    await ctx.post(`/conversations/${ctx.conversation.id}/share`);
    ctx.as(ctx.outsider);
    expect(await ctx.statuses(ctx.readPaths)).toEqual([404, 404, 404, 404]);
    expect(await (await ctx.get("/runs")).json()).toEqual([]);
    expect(
      (
        await ctx.post(`/runs/${ctx.run.id}/apply`, {
          proposalIds: [ctx.proposal.id],
        })
      ).status,
    ).toBe(404);
  });

  it("shares workspace-scoped conversations with every member", async () => {
    const ctx = await setup("workspace");
    await ctx.post(`/conversations/${ctx.conversation.id}/share`);
    ctx.as(ctx.outsider);
    expect(await ctx.statuses(ctx.readPaths)).toEqual([200, 200, 200, 200]);
  });

  it("revokes access as soon as the owner unshares", async () => {
    const ctx = await setup();
    await ctx.post(`/conversations/${ctx.conversation.id}/share`);
    ctx.as(ctx.viewer);
    expect(await ctx.statuses(ctx.readPaths)).toEqual([200, 200, 200, 200]);
    ctx.as(ctx.owner);
    const unshared = await ctx.post(
      `/conversations/${ctx.conversation.id}/unshare`,
    );
    expect(unshared.status).toBe(200);
    expect((await unshared.json()).sharedAt).toBeNull();
    expect(await ctx.statuses(ctx.readPaths)).toEqual([200, 200, 200, 200]);
    expect(await (await ctx.get("/runs")).json()).toEqual([
      expect.objectContaining({ id: ctx.run.id, shared: false }),
    ]);
    ctx.as(ctx.viewer);
    expect(await ctx.statuses(ctx.readPaths)).toEqual([404, 404, 404, 404]);
    expect(await (await ctx.get("/runs")).json()).toEqual([]);
  });
});

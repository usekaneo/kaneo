import { randomUUID } from "node:crypto";
import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { cleanupPendingAgentUploads } from "../../apps/api/src/agent/cleanup-pending-uploads";
import { requireAgentConfig } from "../../apps/api/src/agent/config";
import { executeAgentRun } from "../../apps/api/src/agent/runner";
import { UNSUPPORTED_ATTACHMENTS_ERROR } from "../../apps/api/src/agent/unsupported-input-error";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("KANEO_AGENT_ENABLED", "true");
  vi.stubEnv("OPENROUTER_API_KEY", "fake-test-key");
  vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-6-luna");
});
afterEach(() => vi.unstubAllEnvs());

const png = Buffer.from("\x89PNG\r\n\x1a\nimage-bytes", "latin1");
const pdf = Buffer.from("%PDF-1.7\nspec", "latin1");
const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};
const answer = () => ({
  stream: new ReadableStream({
    start(controller) {
      controller.enqueue({ type: "stream-start", warnings: [] });
      controller.enqueue({ type: "text-start", id: "a" });
      controller.enqueue({ type: "text-delta", id: "a", delta: "Seen." });
      controller.enqueue({ type: "text-end", id: "a" });
      controller.enqueue({
        type: "finish",
        finishReason: { unified: "stop", raw: "stop" },
        usage,
      });
      controller.close();
    },
  }),
});

function client(app: ReturnType<typeof createApp>["app"], workspaceId: string) {
  const base = `/api/agent/${workspaceId}`;
  return {
    get: (path: string) => app.request(`${base}${path}`),
    post: (path: string, body: unknown) =>
      app.request(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
  };
}

async function setup() {
  const { user, workspace } = await createWorkspaceMember({ role: "member" });
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  mockAuthenticatedSession(user);
  const { app } = createApp();
  const api = client(app, workspace.id);
  const conversation = await (
    await api.post("/conversations", { projectId: project.id })
  ).json();
  const upload = async (
    name: string,
    mediaType: string,
    bytes: Buffer,
    as = api,
  ) =>
    as.post("/attachments", {
      name,
      mediaType,
      data: bytes.toString("base64"),
    });
  return { app, api, user, workspace, project, conversation, upload };
}

async function startRun(runId: string) {
  const owner = randomUUID();
  const [run] = await db
    .update(schema.agentRunTable)
    .set({
      status: "running",
      leaseOwner: owner,
      leaseExpiresAt: new Date(Date.now() + 60000),
    })
    .where(eq(schema.agentRunTable.id, runId))
    .returning();
  return { run, owner };
}

describe("agent run attachments", () => {
  it("stores uploads by reference and gives the runner image and PDF parts", async () => {
    const ctx = await setup();
    const image = await ctx.upload("mockup.png", "image/png", png);
    expect(image.status).toBe(201);
    const imageBody = await image.json();
    expect(imageBody).toEqual({
      id: expect.any(String),
      name: "mockup.png",
      mediaType: "image/png",
      size: png.length,
    });
    const doc = await (
      await ctx.upload("spec.pdf", "application/pdf", pdf)
    ).json();

    const requestId = randomUUID();
    const body = {
      requestId,
      prompt: "What does the mockup show?",
      attachments: [
        { id: imageBody.id },
        { name: "notes.md", content: "Ship it" },
        { id: doc.id },
      ],
    };
    const created = await ctx.api.post(
      `/conversations/${ctx.conversation.id}/runs`,
      body,
    );
    expect(created.status).toBe(202);
    const queued = await created.json();
    const retried = await ctx.api.post(
      `/conversations/${ctx.conversation.id}/runs`,
      body,
    );
    expect(await retried.json()).toEqual(queued);

    const stored = await db.query.agentRunTable.findFirst({
      where: eq(schema.agentRunTable.id, queued.id),
    });
    expect(stored?.attachments).toEqual([
      {
        id: imageBody.id,
        name: "mockup.png",
        mediaType: "image/png",
        size: png.length,
      },
      { name: "notes.md", content: "Ship it" },
      {
        id: doc.id,
        name: "spec.pdf",
        mediaType: "application/pdf",
        size: pdf.length,
      },
    ]);

    const listed = await (
      await ctx.api.get(`/conversations/${ctx.conversation.id}/runs`)
    ).text();
    expect(listed).not.toContain(png.toString("base64"));
    expect(JSON.parse(listed)[0].attachments).toEqual([
      {
        type: "file",
        id: imageBody.id,
        name: "mockup.png",
        mediaType: "image/png",
        size: png.length,
      },
      { type: "text", name: "notes.md", size: 7 },
      {
        type: "file",
        id: doc.id,
        name: "spec.pdf",
        mediaType: "application/pdf",
        size: pdf.length,
      },
    ]);

    const content = await ctx.api.get(`/attachments/${imageBody.id}/content`);
    expect(content.status).toBe(200);
    expect(content.headers.get("content-type")).toBe("image/png");
    expect(content.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await content.arrayBuffer())).toEqual(png);
    const pdfContent = await ctx.api.get(`/attachments/${doc.id}/content`);
    expect(pdfContent.headers.get("content-disposition")).toMatch(
      /^attachment;/,
    );

    const { run, owner } = await startRun(queued.id);
    const model = new MockLanguageModelV4({ doStream: [answer()] });
    await executeAgentRun(
      run,
      ctx.conversation,
      requireAgentConfig(),
      owner,
      new AbortController().signal,
      model,
    );
    const user = model.doStreamCalls[0]?.prompt.at(-1);
    expect(user?.role).toBe("user");
    const parts = user?.role === "user" ? user.content : [];
    expect(parts[0]).toMatchObject({ type: "text" });
    expect(JSON.stringify(parts[0])).toContain("Ship it");
    const files = parts.filter((part) => part.type === "file");
    expect(files).toMatchObject([
      { mediaType: "image/png", filename: "mockup.png" },
      { mediaType: "application/pdf", filename: "spec.pdf" },
    ]);
    const bytes = files.map((part) =>
      part.type === "file" && part.data.type === "data"
        ? Buffer.from(part.data.data as Uint8Array)
        : null,
    );
    expect(bytes).toEqual([png, pdf]);
    expect(
      (
        await db.query.agentRunTable.findFirst({
          where: eq(schema.agentRunTable.id, queued.id),
        })
      )?.status,
    ).toBe("completed");
  });

  it("keeps uploads private to their uploader and usable by one run", async () => {
    const ctx = await setup();
    const image = await (await ctx.upload("a.png", "image/png", png)).json();

    // Even a workspace admin cannot read or reuse someone else's upload.
    const { user: other } = await createWorkspaceMember({ role: "admin" });
    await db.insert(schema.workspaceUserTable).values({
      userId: other.id,
      workspaceId: ctx.workspace.id,
      role: "admin",
      joinedAt: new Date(),
    });
    mockAuthenticatedSession(other);
    const otherApi = client(createApp().app, ctx.workspace.id);
    expect(
      (await otherApi.get(`/attachments/${image.id}/content`)).status,
    ).toBe(404);
    const otherConversation = await (
      await otherApi.post("/conversations", {})
    ).json();
    expect(
      (
        await otherApi.post(`/conversations/${otherConversation.id}/runs`, {
          requestId: randomUUID(),
          prompt: "Use their screenshot",
          attachments: [{ id: image.id }],
        })
      ).status,
    ).toBe(404);
    expect(
      await db.query.agentAttachmentTable.findFirst({
        where: eq(schema.agentAttachmentTable.id, image.id),
      }),
    ).toMatchObject({ runId: null, userId: ctx.user.id });

    mockAuthenticatedSession(ctx.user);
    const first = await ctx.api.post(
      `/conversations/${ctx.conversation.id}/runs`,
      {
        requestId: randomUUID(),
        prompt: "Look",
        attachments: [{ id: image.id }],
      },
    );
    expect(first.status).toBe(202);
    await db
      .update(schema.agentRunTable)
      .set({ status: "completed" })
      .where(eq(schema.agentRunTable.id, (await first.json()).id));
    const reused = await ctx.api.post(
      `/conversations/${ctx.conversation.id}/runs`,
      {
        requestId: randomUUID(),
        prompt: "Look again",
        attachments: [{ id: image.id }],
      },
    );
    expect(reused.status).toBe(404);
  });

  it("validates media types, signatures, size, and pending uploads", async () => {
    const ctx = await setup();
    expect(
      (await ctx.upload("a.svg", "image/svg+xml", Buffer.from("<svg/>")))
        .status,
    ).toBe(400);
    expect((await ctx.upload("fake.png", "image/png", pdf)).status).toBe(400);
    const big = Buffer.concat([pdf, Buffer.alloc(5 * 1024 * 1024)]);
    expect([400, 413]).toContain(
      (await ctx.upload("big.pdf", "application/pdf", big)).status,
    );
    for (let index = 0; index < 20; index++)
      expect((await ctx.upload(`${index}.png`, "image/png", png)).status).toBe(
        201,
      );
    expect((await ctx.upload("21.png", "image/png", png)).status).toBe(429);
  });

  it("explains when the model rejects image input", async () => {
    const ctx = await setup();
    const image = await (await ctx.upload("a.png", "image/png", png)).json();
    const queued = await (
      await ctx.api.post(`/conversations/${ctx.conversation.id}/runs`, {
        requestId: randomUUID(),
        prompt: "Describe",
        attachments: [{ id: image.id }],
      })
    ).json();
    const { run, owner } = await startRun(queued.id);
    const model = new MockLanguageModelV4({
      doStream: async () => {
        throw new APICallError({
          message: "No endpoints found that support image input",
          url: "https://openrouter.ai/api/v1/chat/completions",
          requestBodyValues: {},
          statusCode: 404,
        });
      },
    });
    await executeAgentRun(
      run,
      ctx.conversation,
      requireAgentConfig(),
      owner,
      new AbortController().signal,
      model,
    );
    expect(
      await db.query.agentRunTable.findFirst({
        where: eq(schema.agentRunTable.id, queued.id),
      }),
    ).toMatchObject({ status: "failed", error: UNSUPPORTED_ATTACHMENTS_ERROR });
  });

  it("expires unsent uploads but keeps sent ones", async () => {
    const ctx = await setup();
    const pending = await (await ctx.upload("a.png", "image/png", png)).json();
    const sent = await (await ctx.upload("b.png", "image/png", png)).json();
    await ctx.api.post(`/conversations/${ctx.conversation.id}/runs`, {
      requestId: randomUUID(),
      prompt: "Look",
      attachments: [{ id: sent.id }],
    });
    await db
      .update(schema.agentAttachmentTable)
      .set({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) });

    await cleanupPendingAgentUploads();

    const remaining = await db
      .select({ id: schema.agentAttachmentTable.id })
      .from(schema.agentAttachmentTable);
    expect(remaining).toEqual([{ id: sent.id }]);
    expect(remaining).not.toContainEqual({ id: pending.id });
  });
});

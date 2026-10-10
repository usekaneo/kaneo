import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const publish = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<object>()),
  publishEvent: publish,
}));
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});

async function setup(role = "member") {
  const member = await createWorkspaceMember({ role });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  mockAuthenticatedSession(member.user);
  return { ...member, project };
}

function create(
  projectId: string,
  externalLinks: unknown[],
  draftAssetId?: string,
) {
  return createApp().app.request(`/api/task/${projectId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Resource draft",
      description: draftAssetId ? `![draft](/api/asset/${draftAssetId})` : "",
      status: "to-do",
      priority: "no-priority",
      externalLinks,
      draftAssetIds: draftAssetId ? [draftAssetId] : undefined,
    }),
  });
}

describe("resources during task creation", () => {
  it("rejects more than 100 resources without partial creation", async () => {
    const ctx = await setup();
    expect(
      (
        await create(
          ctx.project.id,
          Array.from({ length: 101 }, () => ({ url: "https://example.com" })),
        )
      ).status,
    ).toBe(400);
    expect(await db.query.taskTable.findMany()).toHaveLength(0);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
    expect(publish).not.toHaveBeenCalled();
  });

  it("does not create resources in an inaccessible workspace", async () => {
    const owner = await setup();
    const other = await createWorkspaceMember();
    mockAuthenticatedSession(other.user);
    expect(
      (await create(owner.project.id, [{ url: "https://example.com" }])).status,
    ).toBe(404);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
    expect(publish).not.toHaveBeenCalled();
  });
  it("persists resource links before publishing creation and returns them in the task", async () => {
    const ctx = await setup();
    publish.mockImplementationOnce(async () => {
      expect(await db.query.externalLinkTable.findMany()).toHaveLength(2);
    });
    const response = await create(ctx.project.id, [
      { url: "https://example.com/design", title: "Design" },
      { url: "http://example.com/notes" },
    ]);
    expect(response.status).toBe(200);
    const task = await response.json();
    expect(task.externalLinks).toMatchObject([
      {
        taskId: task.id,
        url: "https://example.com/design",
        title: "Design",
        resourceType: "url",
        integrationId: null,
        metadata: null,
      },
      {
        taskId: task.id,
        url: "http://example.com/notes",
        title: null,
        resourceType: "url",
      },
    ]);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(2);
    expect(publish).toHaveBeenCalledExactlyOnceWith(
      "task.created",
      expect.objectContaining({ taskId: task.id }),
    );
  });

  it.each(["javascript:alert(1)", "ftp://example.com/file", "not a URL"])(
    "rejects %s without creating a task or resources",
    async (url) => {
      const ctx = await setup();
      expect((await create(ctx.project.id, [{ url }])).status).toBe(400);
      expect(await db.query.taskTable.findMany()).toHaveLength(0);
      expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
      expect(publish).not.toHaveBeenCalled();
    },
  );

  it("rolls back resources and task numbering when creation fails", async () => {
    const ctx = await setup();
    const before = await db.query.projectTable.findFirst({
      where: eq(schema.projectTable.id, ctx.project.id),
    });
    expect(
      (
        await create(
          ctx.project.id,
          [{ url: "https://example.com" }],
          "missing",
        )
      ).status,
    ).toBe(400);
    expect(await db.query.taskTable.findMany()).toHaveLength(0);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
    expect(
      await db.query.projectTable.findFirst({
        where: eq(schema.projectTable.id, ctx.project.id),
      }),
    ).toEqual(before);
    expect(publish).not.toHaveBeenCalled();
  });

  it("requires create permission, but not permission to update existing tasks", async () => {
    const ctx = await setup("creator");
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: ctx.workspace.id,
      role: "creator",
      permission: JSON.stringify({ task: ["create", "read"] }),
    });
    expect(
      (await create(ctx.project.id, [{ url: "https://example.com" }])).status,
    ).toBe(200);
    const viewer = await setup("viewer");
    expect(
      (await create(viewer.project.id, [{ url: "https://example.com" }]))
        .status,
    ).toBe(403);
    expect(await db.query.taskTable.findMany()).toHaveLength(1);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(1);
  });
});

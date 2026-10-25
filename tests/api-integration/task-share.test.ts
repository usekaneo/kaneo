import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { getSharedTaskImage } from "../../apps/api/src/shared-task/service";
import {
  BOARD_DESCRIPTION_MAX_BYTES,
  DESCRIPTION_CHUNK_CHARACTERS,
} from "../../apps/api/src/task/description-pages";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function setup(role = "owner") {
  const member = await createWorkspaceMember({ role });
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
    slug: "garage",
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.inProgress.id,
      number: 42,
      title: "Replace brake pads",
      description: "Inspection complete",
      status: columns.inProgress.slug,
      priority: "high",
      userId: member.user.id,
      startDate: new Date("2026-10-18T12:00:00Z"),
      dueDate: new Date("2026-10-20T12:00:00Z"),
    })
    .returning();
  const session = mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const managePath = `/api/task-share/${task.id}`;
  return { member, project, columns, task, session, app, managePath };
}

describe("API integration: shared tasks", () => {
  beforeEach(resetTestDatabase);

  it("creates one stable link and returns only the public field whitelist", async () => {
    const { app, managePath, project, task, member } = await setup();

    expect(await (await app.request(managePath)).json()).toEqual({
      share: null,
    });
    const [first, second] = await Promise.all([
      app.request(managePath, { method: "PUT" }),
      app.request(managePath, { method: "PUT" }),
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const firstShare = (await first.json()) as { token: string };
    const secondShare = (await second.json()) as { token: string };
    expect(firstShare.token).toMatch(/^[a-f0-9]{64}$/);
    expect(secondShare.token).toBe(firstShare.token);

    const response = await app.request(`/api/shared-task/${firstShare.token}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const shared = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(shared).sort()).toEqual(
      [
        "assigneeName",
        "createdAt",
        "description",
        "descriptionDeferred",
        "dueDate",
        "priority",
        "startDate",
        "status",
        "ticketKey",
        "title",
        "updatedAt",
      ].sort(),
    );
    expect(shared).toMatchObject({
      ticketKey: "GARAGE-42",
      title: "Replace brake pads",
      description: "Inspection complete",
      priority: "high",
      assigneeName: member.user.name,
      status: {
        slug: "in-progress",
        name: "In Progress",
        isFinal: false,
      },
    });
    const serialized = JSON.stringify(shared);
    expect(serialized).not.toContain(member.user.email);
    expect(serialized).not.toContain(member.user.id);
    expect(serialized).not.toContain(project.id);
    expect(serialized).not.toContain(project.name);
    expect(serialized).not.toContain(task.id);
  });

  it("reflects live task and assignee updates without exposing identity details", async () => {
    const { app, managePath, task, columns } = await setup();
    const share = (await (
      await app.request(managePath, { method: "PUT" })
    ).json()) as { token: string };
    const [newAssignee] = await db
      .insert(schema.userTable)
      .values({
        id: "customer-facing-assignee",
        name: "Jamie Mechanic",
        email: "jamie.private@example.com",
        emailVerified: true,
        image: "https://private.example/avatar.png",
      })
      .returning();
    await db
      .update(schema.taskTable)
      .set({
        title: "Brake service complete",
        status: columns.done.slug,
        columnId: columns.done.id,
        priority: "urgent",
        userId: newAssignee.id,
      })
      .where(eq(schema.taskTable.id, task.id));

    const updated = await (
      await app.request(`/api/shared-task/${share.token}`)
    ).json();
    expect(updated).toMatchObject({
      title: "Brake service complete",
      priority: "urgent",
      assigneeName: "Jamie Mechanic",
      status: { slug: "done", name: "Done", isFinal: true },
    });
    expect(JSON.stringify(updated)).not.toContain("jamie.private@example.com");
    expect(JSON.stringify(updated)).not.toContain("avatar.png");

    await db
      .update(schema.taskTable)
      .set({ userId: null })
      .where(eq(schema.taskTable.id, task.id));
    expect(
      await (await app.request(`/api/shared-task/${share.token}`)).json(),
    ).toMatchObject({ assigneeName: null });
  });

  it("sanitizes excluded description widgets and scopes image access to the task", async () => {
    const { app, managePath, member, project, task } = await setup();
    const [image, file, commentImage] = await db
      .insert(schema.assetTable)
      .values([
        {
          id: "description-image",
          workspaceId: member.workspace.id,
          projectId: project.id,
          taskId: task.id,
          objectKey: "shared/image.png",
          filename: "repair.png",
          mimeType: "image/png",
          size: 12,
          kind: "image",
          surface: "description",
        },
        {
          id: "description-file",
          workspaceId: member.workspace.id,
          projectId: project.id,
          taskId: task.id,
          objectKey: "shared/invoice.pdf",
          filename: "private-invoice.pdf",
          mimeType: "application/pdf",
          size: 12,
          kind: "attachment",
          surface: "description",
        },
        {
          id: "comment-image",
          workspaceId: member.workspace.id,
          projectId: project.id,
          taskId: task.id,
          objectKey: "shared/comment.png",
          filename: "comment.png",
          mimeType: "image/png",
          size: 12,
          kind: "image",
          surface: "comment",
        },
      ])
      .returning();
    await db
      .update(schema.taskTable)
      .set({
        description: [
          `Visible text ![repair](/api/asset/${image.id})`,
          `External link https://external.example/api/asset/should-not-rewrite`,
          `<kaneo-attachment url="http://localhost:1337/api/asset/${file.id}" filename="private-invoice.pdf" mime-type="application/pdf" size="12" />`,
          '<kaneo-embed url="https://youtube.example/private" mode="embed" />',
          '<kaneo-issue-link url="https://kaneo.example/private" issue-key="SECRET-1" task-id="secret" />',
        ].join("\n"),
      })
      .where(eq(schema.taskTable.id, task.id));
    const share = (await (
      await app.request(managePath, { method: "PUT" })
    ).json()) as { token: string };
    const shared = (await (
      await app.request(`/api/shared-task/${share.token}`)
    ).json()) as { description: string };

    expect(shared.description).toContain(
      `/api/shared-task/${share.token}/asset/${image.id}`,
    );
    expect(shared.description).not.toContain("private-invoice.pdf");
    expect(shared.description).not.toContain("youtube.example");
    expect(shared.description).not.toContain("SECRET-1");
    expect(shared.description).toContain(
      "https://external.example/api/asset/should-not-rewrite",
    );
    await expect(
      getSharedTaskImage(share.token, image.id),
    ).resolves.toMatchObject({ id: image.id });
    await expect(
      getSharedTaskImage(share.token, file.id),
    ).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      getSharedTaskImage(share.token, commentImage.id),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("blocks description images removed from the text but still stored on the task", async () => {
    const { app, managePath, member, project, task } = await setup();
    const [image] = await db
      .insert(schema.assetTable)
      .values({
        id: "orphaned-description-image",
        workspaceId: member.workspace.id,
        projectId: project.id,
        taskId: task.id,
        objectKey: "shared/orphan.png",
        filename: "orphan.png",
        mimeType: "image/png",
        size: 12,
        kind: "image",
        surface: "description",
      })
      .returning();
    await db
      .update(schema.taskTable)
      .set({ description: "No embedded images anymore" })
      .where(eq(schema.taskTable.id, task.id));
    const share = (await (
      await app.request(managePath, { method: "PUT" })
    ).json()) as { token: string };

    await expect(
      getSharedTaskImage(share.token, image.id),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (await app.request(`/api/shared-task/${share.token}/asset/${image.id}`))
        .status,
    ).toBe(404);
  });

  it("strips @mention widgets from shared descriptions", async () => {
    const { app, managePath, member, task } = await setup();
    await db
      .update(schema.taskTable)
      .set({
        description: `<kaneo-mention id="${member.user.id}">@${member.user.name}</kaneo-mention> please review`,
      })
      .where(eq(schema.taskTable.id, task.id));
    const share = (await (
      await app.request(managePath, { method: "PUT" })
    ).json()) as { token: string };
    const shared = (await (
      await app.request(`/api/shared-task/${share.token}`)
    ).json()) as { description: string };
    const serialized = JSON.stringify(shared);

    expect(shared.description).toBe(" please review");
    expect(serialized).not.toContain(member.user.id);
    expect(serialized).not.toContain(member.user.name);
  });

  it("revokes the summary and its images and issues a new token when recreated", async () => {
    const { app, managePath, member, project, task } = await setup();
    const [image] = await db
      .insert(schema.assetTable)
      .values({
        id: "revoked-image",
        workspaceId: member.workspace.id,
        projectId: project.id,
        taskId: task.id,
        objectKey: "shared/revoked.png",
        filename: "revoked.png",
        mimeType: "image/png",
        size: 12,
        kind: "image",
        surface: "description",
      })
      .returning();
    const first = (await (
      await app.request(managePath, { method: "PUT" })
    ).json()) as { token: string };

    expect((await app.request(managePath, { method: "DELETE" })).status).toBe(
      200,
    );
    expect((await app.request(`/api/shared-task/${first.token}`)).status).toBe(
      404,
    );
    await expect(
      getSharedTaskImage(first.token, image.id),
    ).rejects.toMatchObject({ status: 404 });

    const second = (await (
      await app.request(managePath, { method: "PUT" })
    ).json()) as { token: string };
    expect(second.token).not.toBe(first.token);
    expect((await app.request(managePath, { method: "DELETE" })).status).toBe(
      200,
    );
  });

  it("uses the same not-found response for malformed, unknown, deleted, and revoked links", async () => {
    const { app, managePath, task } = await setup();
    const share = (await (
      await app.request(managePath, { method: "PUT" })
    ).json()) as { token: string };
    const malformed = await app.request("/api/shared-task/not-a-token");
    const unknown = await app.request(`/api/shared-task/${"a".repeat(64)}`);
    await db.delete(schema.taskTable).where(eq(schema.taskTable.id, task.id));
    const deleted = await app.request(`/api/shared-task/${share.token}`);

    expect([malformed.status, unknown.status, deleted.status]).toEqual([
      404, 404, 404,
    ]);
    const [malformedBody, unknownBody, deletedBody] = await Promise.all([
      malformed.text(),
      unknown.text(),
      deleted.text(),
    ]);
    expect(malformedBody).toBe(unknownBody);
    expect(unknownBody).toBe(deletedBody);
  });

  it("requires authentication and project sharing permission for management", async () => {
    const { app, managePath, session } = await setup("member");
    expect((await app.request(managePath, { method: "PUT" })).status).toBe(403);

    session.mockRestore();
    mockAnonymousSession();
    expect((await app.request(managePath, { method: "PUT" })).status).toBe(401);
  });

  it("allows a custom role with project:share and blocks one without it", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        columnId: columns.todo.id,
        number: 7,
        title: "Custom role share",
        status: columns.todo.slug,
        priority: "low",
      })
      .returning();
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: owner.workspace.id,
      role: "limited",
      permission: JSON.stringify({
        workspace: ["read"],
        project: ["read", "share"],
        task: ["read"],
      }),
    });
    const [sharerUser] = await db
      .insert(schema.userTable)
      .values({
        id: "custom-role-sharer",
        email: "sharer@example.com",
        emailVerified: true,
        name: "Sharer",
      })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: owner.workspace.id,
      userId: sharerUser.id,
      role: "limited",
      joinedAt: new Date(),
    });
    await db.insert(schema.workspaceMemberProjectTable).values({
      workspaceId: owner.workspace.id,
      userId: sharerUser.id,
      projectId: project.id,
    });

    const managePath = `/api/task-share/${task.id}`;
    const { app } = createApp();

    mockAuthenticatedSession(sharerUser);
    expect((await app.request(managePath, { method: "PUT" })).status).toBe(200);

    await db
      .update(schema.workspaceRoleTable)
      .set({
        permission: JSON.stringify({
          workspace: ["read"],
          project: ["read", "update"],
          task: ["read"],
        }),
      })
      .where(eq(schema.workspaceRoleTable.workspaceId, owner.workspace.id));
    expect((await app.request(managePath, { method: "PUT" })).status).toBe(403);
  });

  it("paginates deferred descriptions through the shared-task endpoint", async () => {
    const { app, managePath, task } = await setup();
    const body = "a".repeat(BOARD_DESCRIPTION_MAX_BYTES + 500);
    await db
      .update(schema.taskTable)
      .set({ description: body })
      .where(eq(schema.taskTable.id, task.id));
    const share = (await (
      await app.request(managePath, { method: "PUT" })
    ).json()) as { token: string };

    const summary = await app.request(`/api/shared-task/${share.token}`);
    expect(summary.status).toBe(200);
    const summaryJson = (await summary.json()) as {
      descriptionDeferred: boolean;
      description: string | null;
    };
    expect(summaryJson.descriptionDeferred).toBe(true);
    expect(summaryJson.description).toBeNull();

    const page0 = await app.request(
      `/api/shared-task/${share.token}/description?offset=0`,
    );
    expect(page0.status).toBe(200);
    const page0Json = (await page0.json()) as {
      content: string;
      version: string;
      nextOffset: number | null;
    };
    expect(page0Json.content).toHaveLength(DESCRIPTION_CHUNK_CHARACTERS);
    expect(page0Json.nextOffset).toBe(DESCRIPTION_CHUNK_CHARACTERS);

    const page1 = await app.request(
      `/api/shared-task/${share.token}/description?offset=${page0Json.nextOffset}&version=${encodeURIComponent(page0Json.version)}`,
    );
    expect(page1.status).toBe(200);
    const page1Json = (await page1.json()) as { content: string };
    expect(page1Json.content.length).toBeGreaterThan(0);
  });
});

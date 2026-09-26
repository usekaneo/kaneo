import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const { readObject } = vi.hoisted(() => ({
  readObject: vi.fn(async () => ({
    body: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
    contentLength: 3,
  })),
}));
vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPrivateObject: readObject,
}));

describe("API integration: public project asset visibility", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    readObject.mockClear();
  });

  it("serves public descriptions but denies anonymous and other-workspace access to comment assets", async () => {
    const member = await createWorkspaceMember();
    const outsider = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await db
      .update(schema.projectTable)
      .set({ isPublic: true })
      .where(eq(schema.projectTable.id, project.id));
    const assets = await db
      .insert(schema.assetTable)
      .values(
        ["description", "comment"].map((surface) => ({
          workspaceId: member.workspace.id,
          projectId: project.id,
          objectKey: randomUUID(),
          filename: "image.png",
          mimeType: "image/png",
          size: 3,
          surface,
          createdBy: member.user.id,
        })),
      )
      .returning();
    const description = assets.find((a) => a.surface === "description");
    const comment = assets.find((a) => a.surface === "comment");
    const { app } = createApp();
    mockAnonymousSession();
    const publicResponse = await app.request(`/api/asset/${description?.id}`);
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.headers.get("cache-control")).toMatch(/^public,/);
    expect((await app.request(`/api/asset/${comment?.id}`)).status).toBe(401);
    expect(readObject).toHaveBeenCalledTimes(1);

    mockAuthenticatedSession(outsider.user);
    expect((await app.request(`/api/asset/${comment?.id}`)).status).toBe(403);
    expect(readObject).toHaveBeenCalledTimes(1);

    mockAuthenticatedSession(member.user);
    const privateResponse = await app.request(`/api/asset/${comment?.id}`);
    expect(privateResponse.status).toBe(200);
    expect(privateResponse.headers.get("cache-control")).toMatch(/^private,/);
    expect(readObject).toHaveBeenCalledTimes(2);
  });
});

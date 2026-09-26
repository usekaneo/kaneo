import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);

async function fixture(permissions: Record<string, string[]>) {
  const member = await createWorkspaceMember({ role: "limited" });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  await db.insert(schema.workspaceRoleTable).values({
    workspaceId: member.workspace.id,
    role: "limited",
    permission: JSON.stringify(permissions),
  });
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const put = (body: Record<string, unknown>) =>
    app.request(`/api/project/${project.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: project.name,
        icon: project.icon ?? "Layout",
        slug: project.slug,
        description: project.description ?? "",
        ...body,
      }),
    });
  const stored = async () =>
    (
      await db
        .select({ isPublic: schema.projectTable.isPublic })
        .from(schema.projectTable)
        .where(eq(schema.projectTable.id, project.id))
    )[0]?.isPublic;
  return { put, stored, project };
}

describe("project visibility authorization", () => {
  it("refuses to publish a private project without project:share", async () => {
    const { put, stored } = await fixture({ project: ["read", "update"] });
    const response = await put({ isPublic: true });
    expect(response.status).toBe(403);
    expect(await stored()).toBe(false);
  });

  it("allows an unrelated edit without project:share", async () => {
    const { put, stored } = await fixture({ project: ["read", "update"] });
    const response = await put({ name: "Renamed", isPublic: false });
    expect(response.status).toBe(200);
    expect(await stored()).toBe(false);
  });

  it("allows publishing with project:share", async () => {
    const { put, stored } = await fixture({
      project: ["read", "update", "share"],
    });
    expect((await put({ isPublic: true })).status).toBe(200);
    expect(await stored()).toBe(true);
  });

  it("refuses to unpublish a public project without project:share", async () => {
    const { put, stored, project } = await fixture({
      project: ["read", "update"],
    });
    await db
      .update(schema.projectTable)
      .set({ isPublic: true })
      .where(eq(schema.projectTable.id, project.id));
    expect((await put({ isPublic: false })).status).toBe(403);
    expect(await stored()).toBe(true);
  });

  it("applies the same rule to a scoped API key", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAnonymousSession();
    const key = `kaneo_test_${randomUUID()}`;
    await db.insert(schema.apikeyTable).values({
      referenceId: member.user.id,
      userId: member.user.id,
      key: createHash("sha256").update(key).digest("base64url"),
      name: "update-only key",
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions: JSON.stringify({ project: ["read", "update"] }),
      enabled: true,
    });
    const { app } = createApp();
    const response = await app.request(`/api/project/${project.id}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        name: project.name,
        icon: project.icon ?? "Layout",
        slug: project.slug,
        description: project.description ?? "",
        isPublic: true,
      }),
    });
    expect(response.status).toBe(403);
  });
});

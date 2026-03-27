import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

describe("API integration: labels", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects unauthenticated label creation", async () => {
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request("/api/label", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Bug",
        color: "#ff0000",
        workspaceId: "workspace-missing",
      }),
    });

    expect(response.status).toBe(401);
    await expect(response.text()).resolves.toBe("Unauthorized");
  });

  it("creates a label in a workspace for a member", async () => {
    const member = await createWorkspaceMember();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request("/api/label", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Bug",
        color: "#ef4444",
        workspaceId: member.workspace.id,
      }),
    });

    expect(response.status).toBe(200);
    const payload =
      (await response.json()) as typeof schema.labelTable.$inferSelect;

    expect(payload).toMatchObject({
      workspaceId: member.workspace.id,
      name: "Bug",
      color: "#ef4444",
    });

    const persisted = await db.query.labelTable.findFirst({
      where: eq(schema.labelTable.id, payload.id),
    });

    expect(persisted).toMatchObject({
      id: payload.id,
      workspaceId: member.workspace.id,
      name: "Bug",
      color: "#ef4444",
    });
  });
});

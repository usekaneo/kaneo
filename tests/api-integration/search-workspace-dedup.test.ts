import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

describe("global search workspace results", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("returns a workspace once regardless of its member count", async () => {
    const member = await createWorkspaceMember({
      workspaceName: "Repro Space",
    });
    const other = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: member.workspace.id,
      userId: other.user.id,
      role: "member",
      joinedAt: new Date(),
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const response = await app.request(
      `/api/search?${new URLSearchParams({ q: "repro", type: "workspaces", workspaceId: member.workspace.id })}`,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({
      id: member.workspace.id,
      type: "workspace",
    });
    expect(body.totalCount).toBe(1);
  });
});

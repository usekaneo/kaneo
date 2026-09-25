import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("short task ID search bounds", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });
  it("handles invalid int4 IDs without querying an overflowing task number", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "DEP",
    });
    await db.insert(schema.taskTable).values({
      projectId: project.id,
      title: "Boundary",
      number: 2_147_483_647,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    for (const number of [
      "2147483648",
      "999999999999999999999999999999",
      "9".repeat(400),
      "0",
    ]) {
      const response = await app.request(
        `/api/search?${new URLSearchParams({ q: `DEP-${number}`, workspaceId: member.workspace.id, type: "tasks" })}`,
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ results: [] });
    }
    const valid = await app.request(
      `/api/search?${new URLSearchParams({ q: "DEP-2147483647", workspaceId: member.workspace.id, type: "tasks" })}`,
    );
    expect(valid.status).toBe(200);
    expect(await valid.json()).toMatchObject({
      results: [
        expect.objectContaining({
          title: "Boundary",
          taskNumber: 2_147_483_647,
        }),
      ],
    });
    const oversized = await app.request(
      `/api/search?${new URLSearchParams({ q: "9".repeat(513), workspaceId: member.workspace.id })}`,
    );
    expect(oversized.status).toBe(400);
  });
});

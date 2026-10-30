import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
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
});

async function importTitles(
  app: ReturnType<typeof createApp>["app"],
  projectId: string,
  titles: string[],
) {
  const response = await app.request(`/api/task/import/${projectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tasks: titles.map((title) => ({ title, status: "to-do" })),
    }),
  });
  expect(response.status).toBe(200);
}

describe("task import", () => {
  it("keeps the file order and appends after existing tasks", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });

    mockAuthenticatedSession(user);
    const { app } = createApp();

    await importTitles(app, project.id, ["First", "Second", "Third"]);
    await importTitles(app, project.id, ["Fourth"]);

    const stored = await db
      .select({
        title: schema.taskTable.title,
        position: schema.taskTable.position,
      })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, project.id))
      .orderBy(asc(schema.taskTable.position));

    expect(stored.map((task) => task.title)).toEqual([
      "First",
      "Second",
      "Third",
      "Fourth",
    ]);
    expect(new Set(stored.map((task) => task.position)).size).toBe(4);
  });
});

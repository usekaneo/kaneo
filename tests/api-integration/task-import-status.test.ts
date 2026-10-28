import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import updateColumn from "../../apps/api/src/column/controllers/update-column";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);

describe("JSON imports after column renames", () => {
  it("accepts the renamed name and its slug while retaining stored status identities", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    await updateColumn(columns.todo.id, { name: "Ready to Start" });
    mockAuthenticatedSession(user);
    const { app } = createApp();
    const response = await app.request(`/api/task/import/${project.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tasks: [
          "Ready to Start",
          "ready-to-start",
          "to-do",
          "planned",
          "unknown",
        ].map((status) => ({ title: status, status })),
      }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results.successful).toBe(5);
    const imported = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, project.id));
    for (const title of ["Ready to Start", "ready-to-start", "to-do"]) {
      expect(imported.find((task) => task.title === title)).toMatchObject({
        status: "to-do",
        columnId: columns.todo.id,
      });
    }
    for (const title of ["planned", "unknown"]) {
      expect(imported.find((task) => task.title === title)).toMatchObject({
        status: "planned",
        columnId: null,
      });
    }
    expect(
      body.results.tasks.find(
        (entry: { task: { title: string } }) => entry.task.title === "unknown",
      ).warnings,
    ).toEqual(['Unknown status "unknown" mapped to "planned"']);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("search excludeProjectId", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("leaves out matches from the excluded project, so other-project matches stay reachable", async () => {
    const member = await createWorkspaceMember();
    const { project: currentProject } = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "CUR",
    });
    const { project: otherProject } = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "OTH",
    });

    // Enough same-project matches to fill a small page on their own, so a
    // caller that forgot to exclude the current project would starve out
    // the one match that lives in another project.
    for (let i = 0; i < 5; i++) {
      await db.insert(schema.taskTable).values({
        projectId: currentProject.id,
        title: `Widget task ${i}`,
        number: i + 1,
      });
    }
    await db.insert(schema.taskTable).values({
      projectId: otherProject.id,
      title: "Widget task in another project",
      number: 1,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/search?${new URLSearchParams({
        q: "widget",
        workspaceId: member.workspace.id,
        type: "tasks",
        excludeProjectId: currentProject.id,
        limit: "3",
      })}`,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results.length).toBeGreaterThan(0);
    for (const result of body.results) {
      expect(result.projectId).not.toBe(currentProject.id);
    }
    expect(body.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ projectId: otherProject.id }),
      ]),
    );
  });

  it("ignores excludeProjectId when projectId scopes the search to that same project", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "SOL",
    });
    await db.insert(schema.taskTable).values({
      projectId: project.id,
      title: "Solo task",
      number: 1,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/search?${new URLSearchParams({
        q: "solo",
        workspaceId: member.workspace.id,
        type: "tasks",
        projectId: project.id,
        excludeProjectId: project.id,
      })}`,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      results: [expect.objectContaining({ title: "Solo task" })],
    });
  });
});

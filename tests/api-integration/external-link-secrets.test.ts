import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const GITEA_TOKEN = "gitea-pat-should-never-be-exposed";
const WEBHOOK_SECRET = "gitea-webhook-secret-should-never-be-exposed";

describe("API integration: external link integration secrets", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("does not expose integration config to a workspace viewer", async () => {
    const viewer = await createWorkspaceMember({ role: "viewer" });
    const { project, columns } = await createProjectFixture({
      workspaceId: viewer.workspace.id,
    });

    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Task with a linked Gitea issue",
        status: "to-do",
        columnId: columns.todo.id,
        priority: "medium",
        number: 1,
        position: 1,
      })
      .returning();

    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: project.id,
        type: "gitea",
        config: JSON.stringify({
          baseUrl: "https://gitea.example",
          accessToken: GITEA_TOKEN,
          repositoryOwner: "owner",
          repositoryName: "repo",
          webhookSecret: WEBHOOK_SECRET,
        }),
        isActive: true,
      })
      .returning();

    await db.insert(schema.externalLinkTable).values({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "issue",
      externalId: "1",
      url: "https://gitea.example/owner/repo/issues/1",
      title: "Linked issue",
    });

    mockAuthenticatedSession(viewer.user);

    const { app } = createApp();
    const response = await app.request(`/api/external-link/task/${task.id}`);

    expect(response.status).toBe(200);
    const body = await response.text();

    expect(body).not.toContain(GITEA_TOKEN);
    expect(body).not.toContain(WEBHOOK_SECRET);
    expect(body).not.toContain("config");

    const links = JSON.parse(body);
    expect(links).toHaveLength(1);
    expect(links[0].integration).toEqual({
      id: integration.id,
      type: "gitea",
    });
  });
});

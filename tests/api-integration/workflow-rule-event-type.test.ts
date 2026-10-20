import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { projectAccessApi } from "./helpers/project-access/project-access-api";

beforeEach(resetTestDatabase);

async function ownerProject() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const fixture = await createProjectFixture({
    workspaceId: owner.workspace.id,
  });
  mockAuthenticatedSession(owner.user);
  return fixture;
}

function putRule(projectId: string, eventType: string, columnId: string) {
  return projectAccessApi()(`/workflow-rule/${projectId}`, {
    method: "PUT",
    body: {
      integrationType: "github",
      eventType,
      columnId,
    },
  });
}

describe("workflow rule event types", () => {
  it("rejects a provider event name and stores nothing", async () => {
    const { project, columns } = await ownerProject();

    const response = await putRule(
      project.id,
      "pull_request.opened",
      columns.inProgress.id,
    );

    expect(response.status).toBe(400);
    const rows = await db
      .select()
      .from(schema.workflowRuleTable)
      .where(eq(schema.workflowRuleTable.projectId, project.id));
    expect(rows).toHaveLength(0);
  });

  it("accepts a Kaneo event type", async () => {
    const { project, columns } = await ownerProject();

    const response = await putRule(
      project.id,
      "pr_opened",
      columns.inProgress.id,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { eventType: string };
    expect(body.eventType).toBe("pr_opened");
  });
});

import db, { schema } from "../../../apps/api/src/database";
import { createProjectFixture, createWorkspaceMember } from "./fixtures";

export const tangledTestConfig = {
  origin: "https://api.tangled.example",
  repositoryDid: "did:plc:repository",
  repositoryFullName: "did:plc:owner/repo",
  repositoryUrl: "https://tangled.example/owner/repo",
  branchPattern: "{slug}-{number}",
  webhookSecret: "webhook-test-secret",
  active: true,
};

export async function createTangledFixture() {
  const member = await createWorkspaceMember({ role: "admin" });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
    slug: "KAN",
  });
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: "tangled",
      isActive: true,
      config: JSON.stringify(tangledTestConfig),
    })
    .returning();
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      number: 12,
      title: "Linked task",
      status: "done",
    })
    .returning();
  return { ...member, project, integration: integration!, task: task! };
}

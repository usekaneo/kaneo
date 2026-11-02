import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import db, { schema } from "../../../../apps/api/src/database";
import { createApp } from "../../../../apps/api/src/index";
import { mockAuthenticatedSession } from "../auth";
import { createProjectFixture, createWorkspaceMember } from "../fixtures";
import type { CodingGithubFixture } from "./github-fixture";

export async function createCodingFixture(
  github: CodingGithubFixture,
  role = "admin",
) {
  const { user, workspace } = await createWorkspaceMember({ role });
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Fix reconnect",
      number: 135,
      columnId: columns.todo.id,
    })
    .returning();
  await db.insert(schema.accountTable).values({
    id: randomUUID(),
    userId: user.id,
    providerId: "github",
    accountId: "1001",
  });
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: "github",
      config: JSON.stringify({
        repositoryOwner: "acme",
        repositoryName: "widget",
        repositoryId: 42,
        installationId: 11,
        verifiedByUserId: user.id,
        verifiedGithubAccountId: "1001",
        codingAgent: { enabled: true },
        branchPattern: "{slug}-{number}",
      }),
    })
    .returning();
  mockAuthenticatedSession(user);
  const { app } = createApp();
  const base = `/api/agent/${workspace.id}`;
  const post = (path: string, body: unknown = {}, token?: string) =>
    app.request(path.startsWith("/api/") ? path : `${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  const input = {
    requestId: randomUUID(),
    taskId: task!.id,
    integrationId: integration!.id,
    instructions: "Fix reconnect",
  };
  const start = () => post("/jobs", input);
  const oidc = (extra: Record<string, unknown> = {}) =>
    new SignJWT({
      repository: "acme/widget",
      repository_id: "42",
      run_id: "123",
      run_attempt: "1",
      event_name: "workflow_dispatch",
      workflow_ref:
        "acme/widget/.github/workflows/kaneo-agent.yml@refs/heads/main",
      workflow_sha: github.baseSha,
      ...extra,
    })
      .setProtectedHeader({ alg: "RS256", kid: "coding-test" })
      .setIssuer("https://token.actions.githubusercontent.com")
      .setAudience("http://localhost:1337")
      .setSubject("repo:acme/widget:ref:refs/heads/main")
      .setJti(randomUUID())
      .setIssuedAt()
      .setNotBefore("0s")
      .setExpirationTime("5m")
      .sign(github.keys.privateKey);
  return {
    user,
    workspace,
    project,
    task: task!,
    integration: integration!,
    app,
    base,
    post,
    start,
    input,
    oidc,
  };
}

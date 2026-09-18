import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type TaskPayload = {
  id: string;
  projectId: string;
  title: string;
  status: string;
  userId: string | null;
  number: number | null;
};

async function postQuickTask(workspaceId: string, body: object) {
  const { app } = createApp();
  return app.request(`/api/task/workspace/${workspaceId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function dailyProjects(workspaceId: string) {
  return db
    .select()
    .from(schema.projectTable)
    .where(
      and(
        eq(schema.projectTable.workspaceId, workspaceId),
        eq(schema.projectTable.name, "Daily Task"),
      ),
    );
}

describe("API integration: quick task", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("creates the Daily Task project once and assigns the task to the caller", async () => {
    const member = await createWorkspaceMember();
    mockAuthenticatedSession(member.user);

    const [first, second] = await Promise.all([
      postQuickTask(member.workspace.id, { title: "Reply to emails" }),
      postQuickTask(member.workspace.id, { title: "Standup notes" }),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const a = (await first.json()) as TaskPayload;
    const b = (await second.json()) as TaskPayload;

    const projects = await dailyProjects(member.workspace.id);
    expect(projects).toHaveLength(1);
    expect(a.projectId).toBe(projects[0]?.id);
    expect(b.projectId).toBe(projects[0]?.id);
    expect(a).toMatchObject({ status: "to-do", userId: member.user.id });
    expect(new Set([a.number, b.number])).toEqual(new Set([1, 2]));
  });

  it("uses the chosen project and its first column", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);

    const response = await postQuickTask(member.workspace.id, {
      title: "Fix login",
      projectId: project.id,
    });

    expect(response.status).toBe(200);
    const task = (await response.json()) as TaskPayload;
    expect(task).toMatchObject({
      projectId: project.id,
      status: "to-do",
      userId: member.user.id,
    });
    expect(await dailyProjects(member.workspace.id)).toHaveLength(0);
  });

  it("rejects a project from another workspace", async () => {
    const member = await createWorkspaceMember();
    const other = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: other.workspace.id,
    });
    mockAuthenticatedSession(member.user);

    const response = await postQuickTask(member.workspace.id, {
      title: "Sneaky",
      projectId: project.id,
    });

    expect(response.status).toBe(400);
  });

  it("rejects workspaces the caller does not belong to", async () => {
    const member = await createWorkspaceMember();
    const other = await createWorkspaceMember();
    mockAuthenticatedSession(member.user);

    const response = await postQuickTask(other.workspace.id, {
      title: "Not mine",
    });

    expect(response.status).toBe(403);
    expect(await dailyProjects(other.workspace.id)).toHaveLength(0);
  });
});

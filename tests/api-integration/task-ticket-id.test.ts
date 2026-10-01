import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("API integration: task ticket ID lookup", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("returns the exact accessible task with full details", async () => {
    const member = await createWorkspaceMember();
    const outsider = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "DE_",
    });
    const { project: nearMatch } = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "DEX",
    });
    const { project: privateProject } = await createProjectFixture({
      workspaceId: outsider.workspace.id,
      slug: "DE_",
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Direct match",
        description: "Full description",
        number: 23,
        userId: member.user.id,
      })
      .returning();
    await db.insert(schema.taskTable).values([
      { projectId: nearMatch.id, title: "Wildcard match", number: 23 },
      { projectId: privateProject.id, title: "Private match", number: 23 },
    ]);

    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const response = await app.request("/api/task/by-ticket-id/de_-23");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: task.id,
      title: "Direct match",
      description: "Full description",
      assigneeName: member.user.name,
      projectId: project.id,
      number: 23,
    });
    const missing = await app.request("/api/task/by-ticket-id/DE_-24");
    expect(missing.status).toBe(404);
    const privateSelection = await app.request(
      `/api/task/by-ticket-id/DE_-23?workspaceId=${outsider.workspace.id}`,
    );
    expect(privateSelection.status).toBe(404);
  });

  it("disambiguates accessible tasks by workspace or project", async () => {
    const member = await createWorkspaceMember();
    const other = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: other.workspace.id,
      userId: member.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    const first = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "KAN",
    });
    const duplicate = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "kan",
    });
    const second = await createProjectFixture({
      workspaceId: other.workspace.id,
      slug: "KAN",
    });
    await db.insert(schema.taskTable).values([
      { projectId: first.project.id, title: "First", number: 12 },
      { projectId: duplicate.project.id, title: "Duplicate", number: 12 },
      { projectId: second.project.id, title: "Second", number: 12 },
    ]);

    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const ambiguous = await app.request("/api/task/by-ticket-id/KAN-12");
    expect(ambiguous.status).toBe(409);
    const ambiguousInWorkspace = await app.request(
      `/api/task/by-ticket-id/KAN-12?workspaceId=${member.workspace.id}`,
    );
    expect(ambiguousInWorkspace.status).toBe(409);

    const chosenProject = await app.request(
      `/api/task/by-ticket-id/KAN-12?projectId=${duplicate.project.id}`,
    );
    expect(chosenProject.status).toBe(200);
    expect(await chosenProject.json()).toMatchObject({ title: "Duplicate" });

    const selected = await app.request(
      `/api/task/by-ticket-id/KAN-12?workspaceId=${other.workspace.id}`,
    );
    expect(selected.status).toBe(200);
    expect(await selected.json()).toMatchObject({ title: "Second" });
  });

  it("accepts a ticket ID generated from a numeric-leading project name", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "123",
    });
    await db.insert(schema.taskTable).values({
      projectId: project.id,
      title: "Numeric key",
      number: 1,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const response = await app.request("/api/task/by-ticket-id/123-1");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ title: "Numeric key" });
  });

  it("rejects invalid and unauthenticated lookups", async () => {
    const member = await createWorkspaceMember();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    for (const ticketId of ["KAN-0", "KAN-2147483648", "bad-id"]) {
      const response = await app.request(`/api/task/by-ticket-id/${ticketId}`);
      expect(response.status).toBe(400);
    }

    mockAnonymousSession();
    const anonymous = await app.request("/api/task/by-ticket-id/KAN-12");
    expect(anonymous.status).toBe(401);
  });
});

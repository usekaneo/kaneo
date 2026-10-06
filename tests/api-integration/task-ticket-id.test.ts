import { eq, inArray } from "drizzle-orm";
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
      workspaceId: member.workspace.id,
      number: 23,
    });
    const missing = await app.request("/api/task/by-ticket-id/DE_-24");
    expect(missing.status).toBe(404);
    const privateSelection = await app.request(
      `/api/task/by-ticket-id/DE_-23?workspaceId=${outsider.workspace.id}`,
    );
    expect(privateSelection.status).toBe(404);
    const privateSlug = await app.request(
      `/api/task/by-ticket-id/DE_-23?workspaceSlug=${outsider.workspace.slug}`,
    );
    expect(privateSlug.status).toBe(404);
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
    expect(await selected.json()).toMatchObject({
      title: "Second",
      workspaceId: other.workspace.id,
    });

    const bySlug = await app.request(
      `/api/task/by-ticket-id/KAN-12?workspaceSlug=${other.workspace.slug}`,
    );
    expect(bySlug.status).toBe(200);
    const byUpperSlug = await app.request(
      `/api/task/by-ticket-id/KAN-12?workspaceSlug=${other.workspace.slug.toUpperCase()}`,
    );
    expect(byUpperSlug.status).toBe(200);
    expect(await bySlug.json()).toMatchObject({ title: "Second" });
    const unknownSlug = await app.request(
      "/api/task/by-ticket-id/KAN-12?workspaceSlug=no-such-workspace",
    );
    expect(unknownSlug.status).toBe(404);
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

  it("prefers an exact workspace slug over a case-insensitive match", async () => {
    const member = await createWorkspaceMember();
    const other = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: other.workspace.id,
      userId: member.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    await db
      .update(schema.workspaceTable)
      .set({ slug: "case-ws" })
      .where(eq(schema.workspaceTable.id, member.workspace.id));
    await db
      .update(schema.workspaceTable)
      .set({ slug: "CASE-WS" })
      .where(eq(schema.workspaceTable.id, other.workspace.id));
    const lower = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "KAN",
    });
    const upper = await createProjectFixture({
      workspaceId: other.workspace.id,
      slug: "KAN",
    });
    await db.insert(schema.taskTable).values([
      { projectId: lower.project.id, title: "Lower", number: 12 },
      { projectId: upper.project.id, title: "Upper", number: 12 },
    ]);

    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const exactLower = await app.request(
      "/api/task/by-ticket-id/KAN-12?workspaceSlug=case-ws",
    );
    expect(await exactLower.json()).toMatchObject({ title: "Lower" });
    const exactUpper = await app.request(
      "/api/task/by-ticket-id/KAN-12?workspaceSlug=CASE-WS",
    );
    expect(await exactUpper.json()).toMatchObject({ title: "Upper" });
    const mixed = await app.request(
      "/api/task/by-ticket-id/KAN-12?workspaceSlug=Case-Ws",
    );
    expect(mixed.status).toBe(409);
  });

  it("resolves a project key outside the generated key format", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "OPS.2",
    });
    await db.insert(schema.taskTable).values({
      projectId: project.id,
      title: "Dotted key",
      number: 12,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const response = await app.request("/api/task/by-ticket-id/OPS.2-12");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ title: "Dotted key" });
  });

  it("resolves a full-width project key as stored", async () => {
    const member = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "ＡＢＣ",
    });
    await db.insert(schema.taskTable).values({
      projectId: project.id,
      title: "Full-width key",
      number: 1,
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const response = await app.request(
      `/api/task/by-ticket-id/${encodeURIComponent("ＡＢＣ-1")}`,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ title: "Full-width key" });
    const normalized = await app.request("/api/task/by-ticket-id/abc-1");
    expect(normalized.status).toBe(200);
    expect(await normalized.json()).toMatchObject({ title: "Full-width key" });
  });

  it("prefers an active project over an archived one sharing its key", async () => {
    const member = await createWorkspaceMember();
    const { project: active } = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "ARC",
    });
    const { project: archived } = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "arc",
    });
    const { project: alsoArchived } = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "Arc",
    });
    await db
      .update(schema.projectTable)
      .set({ archivedAt: new Date() })
      .where(inArray(schema.projectTable.id, [archived.id, alsoArchived.id]));
    await db.insert(schema.taskTable).values([
      { projectId: active.id, title: "Active", number: 5 },
      { projectId: archived.id, title: "Archived", number: 5 },
      { projectId: alsoArchived.id, title: "Also archived", number: 5 },
      { projectId: archived.id, title: "Archived only", number: 6 },
      { projectId: alsoArchived.id, title: "Also archived only", number: 6 },
    ]);

    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const preferred = await app.request("/api/task/by-ticket-id/ARC-5");
    expect(preferred.status).toBe(200);
    expect(await preferred.json()).toMatchObject({ title: "Active" });
    const archivedOnly = await app.request("/api/task/by-ticket-id/ARC-6");
    expect(archivedOnly.status).toBe(409);

    await db
      .update(schema.projectTable)
      .set({ archivedAt: new Date(Date.now() + 60_000) })
      .where(eq(schema.projectTable.id, active.id));
    const afterArchiving = await app.request("/api/task/by-ticket-id/ARC-5");
    expect(afterArchiving.status).toBe(200);
    expect(await afterArchiving.json()).toMatchObject({ title: "Active" });
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

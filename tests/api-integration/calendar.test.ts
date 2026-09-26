import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

describe("API integration: calendar", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects unauthenticated access", async () => {
    mockAnonymousSession();
    const { app } = createApp();

    const response = await app.request("/api/calendar/workspace-missing");

    expect(response.status).toBe(401);
    await expect(response.text()).resolves.toBe("Unauthorized");
  });

  it("defaults to Mon-Fri (62) with no holidays for a freshly created workspace", async () => {
    const member = await createWorkspaceMember();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/calendar/${member.workspace.id}`);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ workingDays: 62, holidays: [] });
  });

  it("rejects access for a user outside the workspace", async () => {
    const member = await createWorkspaceMember();
    const outsiderId = "user-calendar-outsider";
    const [outsider] = await db
      .insert(schema.userTable)
      .values({
        id: outsiderId,
        email: `${outsiderId}@example.com`,
        emailVerified: true,
        name: "Calendar Outsider",
      })
      .returning();

    mockAuthenticatedSession(outsider);
    const { app } = createApp();

    const response = await app.request(`/api/calendar/${member.workspace.id}`);

    expect(response.status).toBe(403);
  });

  it("lets an admin update the working-days bitmask", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/calendar/${member.workspace.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workingDays: 124 }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ workingDays: 124 });

    const persisted = await db.query.workspaceTable.findFirst({
      where: eq(schema.workspaceTable.id, member.workspace.id),
    });
    expect(persisted?.workingDays).toBe(124);
  });

  it("rejects a working-days update from a plain member", async () => {
    const member = await createWorkspaceMember({ role: "member" });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/calendar/${member.workspace.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workingDays: 124 }),
    });

    expect(response.status).toBe(403);

    const persisted = await db.query.workspaceTable.findFirst({
      where: eq(schema.workspaceTable.id, member.workspace.id),
    });
    expect(persisted?.workingDays).toBe(62);
  });

  it("rejects an out-of-range working-days bitmask", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/calendar/${member.workspace.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workingDays: 128 }),
    });

    expect(response.status).toBe(400);
  });

  it("adds a holiday, normalized to UTC midnight, and returns it sorted by date", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const laterResponse = await app.request(
      `/api/calendar/${member.workspace.id}/holidays`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: "2026-12-25T15:30:00.000Z",
          name: "Christmas",
        }),
      },
    );
    expect(laterResponse.status).toBe(200);
    const laterHoliday = await laterResponse.json();
    expect(laterHoliday.date).toBe("2026-12-25T00:00:00.000Z");
    expect(laterHoliday.name).toBe("Christmas");

    await app.request(`/api/calendar/${member.workspace.id}/holidays`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-01-01", name: "New Year" }),
    });

    const getResponse = await app.request(
      `/api/calendar/${member.workspace.id}`,
    );
    const payload = await getResponse.json();
    expect(payload.holidays).toHaveLength(2);
    // Sorted by date ascending: New Year (Jan 1) before Christmas (Dec 25).
    expect(payload.holidays[0].name).toBe("New Year");
    expect(payload.holidays[1].name).toBe("Christmas");
  });

  it("rejects a duplicate holiday on the same date", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    await app.request(`/api/calendar/${member.workspace.id}/holidays`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: "2026-07-04", name: "Independence Day" }),
    });

    const duplicateResponse = await app.request(
      `/api/calendar/${member.workspace.id}/holidays`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: "2026-07-04", name: "Duplicate" }),
      },
    );

    expect(duplicateResponse.status).toBe(409);

    const persisted = await db.query.workspaceHolidayTable.findMany({
      where: eq(schema.workspaceHolidayTable.workspaceId, member.workspace.id),
    });
    expect(persisted).toHaveLength(1);
  });

  it("rejects adding a holiday from a plain member", async () => {
    const member = await createWorkspaceMember({ role: "member" });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/calendar/${member.workspace.id}/holidays`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: "2026-07-04", name: "Independence Day" }),
      },
    );

    expect(response.status).toBe(403);
  });

  it("deletes a holiday scoped to its workspace", async () => {
    const member = await createWorkspaceMember({ role: "admin" });
    const otherWorkspaceId = "workspace-calendar-other";
    await db.insert(schema.workspaceTable).values({
      id: otherWorkspaceId,
      createdAt: new Date(),
      name: "Other Workspace",
      slug: `${otherWorkspaceId}-slug`,
    });
    // Same user, a second workspace it also belongs to — so the 404 below is
    // the holiday's workspace scope check, not a plain access-control 403.
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: otherWorkspaceId,
      userId: member.user.id,
      role: "admin",
      joinedAt: new Date(),
    });

    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const createResponse = await app.request(
      `/api/calendar/${member.workspace.id}/holidays`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: "2026-03-17", name: "Founders Day" }),
      },
    );
    const holiday = await createResponse.json();

    // Deleting it scoped to a DIFFERENT workspace the user DOES have access
    // to must not find it (it belongs to `member.workspace`, not this one).
    const wrongScopeResponse = await app.request(
      `/api/calendar/${otherWorkspaceId}/holidays/${holiday.id}`,
      { method: "DELETE" },
    );
    expect(wrongScopeResponse.status).toBe(404);

    const deleteResponse = await app.request(
      `/api/calendar/${member.workspace.id}/holidays/${holiday.id}`,
      { method: "DELETE" },
    );
    expect(deleteResponse.status).toBe(200);

    const persisted = await db.query.workspaceHolidayTable.findFirst({
      where: eq(schema.workspaceHolidayTable.id, holiday.id),
    });
    expect(persisted).toBeUndefined();
  });
});

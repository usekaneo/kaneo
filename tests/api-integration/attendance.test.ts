import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { addWorkspaceMember, requestAs } from "./helpers/company";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
});

describe("attendance", () => {
  it("clocks in once, refuses a second clock-in, and clocks out", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "member" });
    const request = requestAs(user);

    const first = await request("/attendance/clock-in", {
      method: "POST",
      body: { workspaceId: workspace.id },
    });
    expect(first.status).toBe(200);
    expect(first.json.clockedIn).toBe(true);

    const again = await request("/attendance/clock-in", {
      method: "POST",
      body: { workspaceId: workspace.id },
    });
    expect(again.status).toBe(409);

    const out = await request("/attendance/clock-out", {
      method: "POST",
      body: { workspaceId: workspace.id },
    });
    expect(out.status).toBe(200);
    expect(out.json.clockedIn).toBe(false);
    expect(out.json.today.sessions).toHaveLength(1);

    expect(
      (
        await request("/attendance/clock-out", {
          method: "POST",
          body: { workspaceId: workspace.id },
        })
      ).status,
    ).toBe(409);
  });

  it("shows your own days, and others' only with people:read_all", async () => {
    const { user: owner, workspace } = await createWorkspaceMember({
      role: "owner",
    });
    const alice = await addWorkspaceMember(workspace.id, "member");
    const bob = await addWorkspaceMember(workspace.id, "member");
    const range = `workspaceId=${workspace.id}&from=2026-09-14&to=2026-09-20`;

    const asAlice = requestAs(alice);
    const own = await asAlice(`/attendance/days?${range}`);
    expect(own.status).toBe(200);
    expect(own.json.days).toHaveLength(7);
    expect(
      (await asAlice(`/attendance/days?${range}&userId=${bob.id}`)).status,
    ).toBe(403);
    expect(
      (
        await asAlice(
          `/attendance/team?workspaceId=${workspace.id}&day=2026-09-14`,
        )
      ).status,
    ).toBe(403);

    const asOwner = requestAs(owner);
    expect(
      (await asOwner(`/attendance/days?${range}&userId=${bob.id}`)).status,
    ).toBe(200);
    const team = await asOwner(
      `/attendance/team?workspaceId=${workspace.id}&day=2026-09-14`,
    );
    expect(team.json).toHaveLength(3);
  });

  it("lets admins correct a forgotten clock-out, audit logged", async () => {
    const { user: owner, workspace } = await createWorkspaceMember({
      role: "owner",
    });
    const alice = await addWorkspaceMember(workspace.id, "member");
    const [session] = await db
      .insert(schema.attendanceSessionTable)
      .values({
        workspaceId: workspace.id,
        userId: alice.id,
        clockIn: new Date("2026-09-14T04:00:00Z"),
      })
      .returning();

    // The employee cannot edit their own record.
    expect(
      (
        await requestAs(alice)(`/attendance/sessions/${session.id}`, {
          method: "PUT",
          body: {
            workspaceId: workspace.id,
            clockIn: "2026-09-14T04:00:00Z",
            clockOut: "2026-09-14T20:00:00Z",
          },
        })
      ).status,
    ).toBe(403);

    const fixed = await requestAs(owner)(`/attendance/sessions/${session.id}`, {
      method: "PUT",
      body: {
        workspaceId: workspace.id,
        clockIn: "2026-09-14T04:00:00Z",
        clockOut: "2026-09-14T13:00:00Z",
      },
    });
    expect(fixed.status).toBe(200);
    expect(fixed.json.clockOut).toBe("2026-09-14T13:00:00.000Z");

    const audit = await db
      .select()
      .from(schema.auditLogTable)
      .where(eq(schema.auditLogTable.action, "attendance.updated"));
    expect(audit).toHaveLength(1);
    expect(audit[0]?.targetId).toBe(alice.id);
  });
});

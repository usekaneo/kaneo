import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { addWorkspaceMember, requestAs } from "./helpers/company";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
});

const settings = (workspaceId: string) => ({
  workspaceId,
  timezone: "Asia/Dhaka",
  currency: "BDT",
  workDays: [7, 1, 2, 3, 4],
  workStart: "10:00",
  workEnd: "19:00",
  breakMinutes: 60,
  annualLeaveDays: 18,
  overtimeRatePercent: 150,
  trackDomains: true,
  activityDetailDays: 90,
  activitySummaryDays: 365,
});

describe("company settings", () => {
  it("serves defaults, lets admins save, and audit logs the change", async () => {
    const { user: owner, workspace } = await createWorkspaceMember({
      role: "owner",
    });
    const employee = await addWorkspaceMember(workspace.id, "member");

    const asEmployee = requestAs(employee);
    const defaults = await asEmployee(
      `/company/settings?workspaceId=${workspace.id}`,
    );
    expect(defaults.json).toMatchObject({ timezone: "UTC", currency: "USD" });
    expect(
      (
        await asEmployee("/company/settings", {
          method: "PUT",
          body: settings(workspace.id),
        })
      ).status,
    ).toBe(403);

    const asOwner = requestAs(owner);
    const saved = await asOwner("/company/settings", {
      method: "PUT",
      body: settings(workspace.id),
    });
    expect(saved.status).toBe(200);
    expect(saved.json.workDays).toEqual([1, 2, 3, 4, 7]);

    const audit = await db
      .select()
      .from(schema.auditLogTable)
      .where(eq(schema.auditLogTable.workspaceId, workspace.id));
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: "company_settings.updated",
      actorId: owner.id,
    });
    expect((audit[0].data as Record<string, unknown>).currency).toEqual({
      from: "USD",
      to: "BDT",
    });
  });

  it("rejects an unknown timezone and a day that ends before it starts", async () => {
    const { user: owner, workspace } = await createWorkspaceMember({
      role: "owner",
    });
    const asOwner = requestAs(owner);

    for (const body of [
      { ...settings(workspace.id), timezone: "Mars/Base" },
      { ...settings(workspace.id), workStart: "19:00", workEnd: "10:00" },
    ]) {
      expect(
        (await asOwner("/company/settings", { method: "PUT", body })).status,
      ).toBe(400);
    }
  });
});

describe("people", () => {
  it("shows the directory to everyone but details only to yourself and managers", async () => {
    const { user: owner, workspace } = await createWorkspaceMember({
      role: "owner",
      userName: "Owner",
    });
    const alice = await addWorkspaceMember(workspace.id, "member", "Alice");
    const bob = await addWorkspaceMember(workspace.id, "member", "Bob");
    const manager = await addWorkspaceMember(workspace.id, "manager", "Mona");

    const asAlice = requestAs(alice);
    const directory = await asAlice(`/people?workspaceId=${workspace.id}`);
    expect(directory.json.map((p: { name: string }) => p.name)).toEqual([
      "Alice",
      "Bob",
      "Mona",
      "Owner",
    ]);
    expect(
      (await asAlice(`/people/${alice.id}?workspaceId=${workspace.id}`)).status,
    ).toBe(200);
    expect(
      (await asAlice(`/people/${bob.id}?workspaceId=${workspace.id}`)).status,
    ).toBe(403);

    const asManager = requestAs(manager);
    expect(
      (await asManager(`/people/${bob.id}?workspaceId=${workspace.id}`)).status,
    ).toBe(200);
    // Managers see people but do not edit profiles.
    expect(
      (
        await asManager(`/people/${bob.id}`, {
          method: "PUT",
          body: { workspaceId: workspace.id, title: "Designer" },
        })
      ).status,
    ).toBe(403);
    expect(owner).toBeDefined();
  });

  it("lets admins edit a profile, departments and a schedule override", async () => {
    const { user: owner, workspace } = await createWorkspaceMember({
      role: "owner",
    });
    const alice = await addWorkspaceMember(workspace.id, "member", "Alice");
    const asOwner = requestAs(owner);

    const department = await asOwner("/company/departments", {
      method: "POST",
      body: { workspaceId: workspace.id, name: "Engineering" },
    });
    expect(department.status).toBe(200);
    expect(
      (
        await asOwner("/company/departments", {
          method: "POST",
          body: { workspaceId: workspace.id, name: "Engineering" },
        })
      ).status,
    ).toBe(409);

    const updated = await asOwner(`/people/${alice.id}`, {
      method: "PUT",
      body: {
        workspaceId: workspace.id,
        title: "Backend developer",
        departmentId: department.json.id,
        joinDate: "2026-01-15",
        workEnd: "15:00",
      },
    });
    expect(updated.status).toBe(200);
    expect(updated.json).toMatchObject({
      title: "Backend developer",
      departmentName: "Engineering",
      joinDate: "2026-01-15",
      status: "active",
      schedule: { workStart: "09:00", workEnd: "15:00" },
      overrides: { workEnd: "15:00", workStart: null },
    });

    const departments = await asOwner(
      `/company/departments?workspaceId=${workspace.id}`,
    );
    expect(departments.json).toEqual([
      { id: department.json.id, name: "Engineering", memberCount: 1 },
    ]);

    const audit = await db
      .select()
      .from(schema.auditLogTable)
      .where(eq(schema.auditLogTable.action, "person.updated"));
    expect(audit[0]?.targetId).toBe(alice.id);
  });

  it("refuses a department from another workspace", async () => {
    const { user: owner, workspace } = await createWorkspaceMember({
      role: "owner",
    });
    const { workspace: other } = await createWorkspaceMember({ role: "owner" });
    const [foreign] = await db
      .insert(schema.departmentTable)
      .values({ workspaceId: other.id, name: "Elsewhere" })
      .returning();
    const alice = await addWorkspaceMember(workspace.id, "member");

    const response = await requestAs(owner)(`/people/${alice.id}`, {
      method: "PUT",
      body: { workspaceId: workspace.id, departmentId: foreign.id },
    });
    expect(response.status).toBe(400);
  });

  it("lists a person's tasks across projects with tracked time", async () => {
    const { user: owner, workspace } = await createWorkspaceMember({
      role: "owner",
    });
    const alice = await addWorkspaceMember(workspace.id, "member");
    const { project, columns } = await createProjectFixture({
      workspaceId: workspace.id,
      name: "Website",
    });
    const [open, other] = await db
      .insert(schema.taskTable)
      .values([
        {
          projectId: project.id,
          title: "Fix API issue",
          status: "to-do",
          columnId: columns.todo?.id ?? null,
          userId: alice.id,
          number: 1,
          estimateMinutes: 180,
        },
        {
          projectId: project.id,
          title: "Someone else's",
          status: "to-do",
          columnId: columns.todo?.id ?? null,
          userId: owner.id,
          number: 2,
        },
      ])
      .returning();
    await db.insert(schema.timeEntryTable).values({
      taskId: open.id,
      userId: alice.id,
      startTime: new Date("2026-01-01T09:00:00Z"),
      endTime: new Date("2026-01-01T11:17:00Z"),
      duration: 8220,
    });

    const tasks = await requestAs(alice)(
      `/people/${alice.id}/tasks?workspaceId=${workspace.id}`,
    );
    expect(tasks.json).toHaveLength(1);
    expect(tasks.json[0]).toMatchObject({
      title: "Fix API issue",
      estimateMinutes: 180,
      trackedSeconds: 8220,
      done: false,
      projectName: "Website",
    });
    expect(other).toBeDefined();
  });
});

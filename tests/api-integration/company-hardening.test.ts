import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { addWorkspaceMember, requestAs } from "./helpers/company";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
});

async function company() {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "owner",
  });
  await db.insert(schema.companySettingsTable).values({
    workspaceId: workspace.id,
    timezone: "Asia/Dhaka",
    currency: "BDT",
    workDays: "7,1,2,3,4",
    workStart: "10:00",
    workEnd: "19:00",
    breakMinutes: 60,
    overtimeRatePercent: 150,
  });
  const alice = await addWorkspaceMember(workspace.id, "member", "Alice");
  const manager = await addWorkspaceMember(workspace.id, "manager", "Mona");
  return { owner, workspace, alice, manager };
}

describe("attendance corrections", () => {
  it("refuses overlapping, future and impossible sessions", async () => {
    const { owner, workspace, alice } = await company();
    const asOwner = requestAs(owner);
    const add = (clockIn: string, clockOut?: string) =>
      asOwner("/attendance/sessions", {
        method: "POST",
        body: {
          workspaceId: workspace.id,
          userId: alice.id,
          clockIn,
          clockOut,
        },
      });

    expect(
      (await add("2026-09-14T04:00:00Z", "2026-09-14T08:00:00Z")).status,
    ).toBe(200);
    // Overlaps the first one.
    expect(
      (await add("2026-09-14T07:00:00Z", "2026-09-14T10:00:00Z")).status,
    ).toBe(409);
    // Right after it is fine.
    const later = await add("2026-09-14T08:00:00Z", "2026-09-14T12:00:00Z");
    expect(later.status).toBe(200);
    // Moving the second one back over the first is refused too.
    expect(
      (
        await asOwner(`/attendance/sessions/${later.json.id}`, {
          method: "PUT",
          body: {
            workspaceId: workspace.id,
            clockIn: "2026-09-14T06:00:00Z",
          },
        })
      ).status,
    ).toBe(409);

    const nextYear = new Date(Date.now() + 365 * 86_400_000).toISOString();
    expect((await add(nextYear)).status).toBe(400);
    // More than a day long.
    expect(
      (await add("2026-09-01T04:00:00Z", "2026-09-03T04:00:00Z")).status,
    ).toBe(400);
  });

  it("rejects dates that don't exist or are far out of range", async () => {
    const { alice, workspace } = await company();
    for (const [from, to] of [
      ["2026-02-31", "2026-03-01"],
      ["0001-01-01", "0001-01-02"],
      ["2026-13-01", "2026-13-02"],
    ]) {
      const response = await requestAs(alice)(
        `/attendance/days?workspaceId=${workspace.id}&from=${from}&to=${to}`,
      );
      expect(response.status, from).toBe(400);
    }
  });
});

describe("payroll", () => {
  it("pays only closed sessions, not a forgotten clock-out", async () => {
    const { owner, workspace, alice } = await company();
    const asOwner = requestAs(owner);
    await asOwner("/pay/salaries", {
      method: "POST",
      body: {
        workspaceId: workspace.id,
        userId: alice.id,
        amount: 10_000,
        type: "hourly",
        effectiveFrom: "2026-01-01",
      },
    });
    await db.insert(schema.attendanceSessionTable).values([
      {
        workspaceId: workspace.id,
        userId: alice.id,
        clockIn: new Date("2026-08-10T04:00:00Z"),
        clockOut: new Date("2026-08-10T06:00:00Z"),
      },
      // Never clocked out: weeks ago, still open.
      {
        workspaceId: workspace.id,
        userId: alice.id,
        clockIn: new Date("2026-08-12T04:00:00Z"),
      },
    ]);

    const draft = await asOwner("/pay/runs", {
      method: "POST",
      body: { workspaceId: workspace.id, year: 2026, month: 8 },
    });
    expect(draft.json.items[0]).toMatchObject({ workedMinutes: 120 });
  });

  it("approves once when two approvals race", async () => {
    const { owner, workspace } = await company();
    const asOwner = requestAs(owner);
    const draft = await asOwner("/pay/runs", {
      method: "POST",
      body: { workspaceId: workspace.id, year: 2026, month: 8 },
    });
    const approve = () =>
      asOwner(`/pay/runs/${draft.json.id}/approve`, {
        method: "POST",
        body: { workspaceId: workspace.id },
      });
    const results = await Promise.all([approve(), approve()]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const audit = await db
      .select()
      .from(schema.auditLogTable)
      .where(eq(schema.auditLogTable.action, "payroll.approved"));
    expect(audit).toHaveLength(1);
  });
});

describe("requests", () => {
  it("decides a leave request once when two approvers race", async () => {
    const { workspace, alice, owner, manager } = await company();
    const requested = await requestAs(alice)("/requests/leave", {
      method: "POST",
      body: {
        workspaceId: workspace.id,
        type: "annual",
        startDate: "2026-09-17",
        endDate: "2026-09-17",
      },
    });
    const decide = (user: typeof owner, decision: string) =>
      requestAs(user)(`/requests/leave/${requested.json.id}/decide`, {
        method: "POST",
        body: { workspaceId: workspace.id, decision },
      });
    const results = await Promise.all([
      decide(owner, "approved"),
      decide(manager, "rejected"),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });
});

describe("audit log", () => {
  it("hides pay amounts from audit readers without payroll:read", async () => {
    const { owner, workspace, alice } = await company();
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: workspace.id,
      role: "auditor",
      permission: JSON.stringify({ audit: ["read"] }),
    });
    const auditor = await addWorkspaceMember(workspace.id, "auditor");
    await requestAs(owner)("/pay/salaries", {
      method: "POST",
      body: {
        workspaceId: workspace.id,
        userId: alice.id,
        amount: 5_000_000,
        type: "monthly",
        effectiveFrom: "2026-01-01",
      },
    });

    const path = `/overview/audit?workspaceId=${workspace.id}`;
    const forAuditor = await requestAs(auditor)(path);
    expect(forAuditor.status).toBe(200);
    const salary = (r: { json: { entries: { action: string }[] } }) =>
      r.json.entries.find((e) => e.action === "salary.added");
    expect(salary(forAuditor)).toMatchObject({ data: null });
    expect(salary(await requestAs(owner)(path))).toMatchObject({
      data: { amount: 5_000_000 },
    });

    expect((await requestAs(owner)(`${path}&before=not-a-date`)).status).toBe(
      400,
    );
  });
});

describe("desktop agent activity", () => {
  it("counts overlapping spans once", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "member" });
    const code = await requestAs(user)("/agent/pairing-code", {
      method: "POST",
      body: { workspaceId: workspace.id },
    });
    const { app } = createApp();
    const post = async (path: string, body: unknown, token?: string) => {
      const response = await app.request(`/api/agent/device${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      return response.json();
    };
    const { token } = await post("/pair", {
      code: code.json.code,
      deviceName: "Laptop",
      platform: "windows",
    });
    const at = (minutesAgo: number) =>
      new Date(Date.now() - minutesAgo * 60_000).toISOString();
    const span = (id: string, from: number, to: number) => ({
      id,
      start: at(from),
      end: at(to),
      state: "active",
      app: "Code",
    });

    expect(
      await post(
        "/activity",
        { spans: [span("span-aaaa", 60, 50), span("span-bbbb", 55, 45)] },
        token,
      ),
    ).toEqual({ accepted: 1, duplicates: 1 });
    // A later upload can't count the same minutes again either.
    expect(
      await post("/activity", { spans: [span("span-cccc", 58, 52)] }, token),
    ).toEqual({ accepted: 0, duplicates: 1 });

    const [daily] = await db
      .select()
      .from(schema.activityDailyTable)
      .where(eq(schema.activityDailyTable.userId, user.id));
    expect(daily?.activeSeconds).toBe(600);
  });
});

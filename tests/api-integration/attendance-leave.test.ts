import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { zonedDay } from "../../apps/api/src/company/zoned-time";
import db, { schema } from "../../apps/api/src/database";
import { addWorkspaceMember, requestAs } from "./helpers/company";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
});

// Every day is a work day, so "today" is always one whenever the test runs.
async function company() {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "owner",
  });
  await db.insert(schema.companySettingsTable).values({
    workspaceId: workspace.id,
    timezone: "Asia/Dhaka",
    workDays: "1,2,3,4,5,6,7",
    annualLeaveDays: 18,
  });
  const alice = await addWorkspaceMember(workspace.id, "member", "Alice");
  const manager = await addWorkspaceMember(workspace.id, "manager", "Mona");
  const today = zonedDay(new Date(), "Asia/Dhaka");
  return { owner, workspace, alice, manager, today };
}

async function notificationsFor(userId: string, type: string) {
  // Notifications are written by event subscribers, just after the response.
  for (let attempt = 0; attempt < 20; attempt++) {
    const rows = await db
      .select()
      .from(schema.notificationTable)
      .where(
        and(
          eq(schema.notificationTable.userId, userId),
          eq(schema.notificationTable.type, type),
        ),
      );
    if (rows.length > 0) return rows;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return [];
}

describe("leave and attendance", () => {
  it("only approved leave marks the day, and blocks clocking in", async () => {
    const { workspace, alice, manager, today } = await company();
    const asAlice = requestAs(alice);
    const asManager = requestAs(manager);

    const requested = await asAlice("/requests/leave", {
      method: "POST",
      body: {
        workspaceId: workspace.id,
        type: "sick",
        startDate: today,
        endDate: today,
      },
    });
    expect(requested.status).toBe(200);

    // Pending leave changes nothing yet.
    const pending = await asAlice(
      `/attendance/status?workspaceId=${workspace.id}`,
    );
    expect(pending.json.today.status).toBe("pending");

    await asManager(`/requests/leave/${requested.json.id}/decide`, {
      method: "POST",
      body: { workspaceId: workspace.id, decision: "approved" },
    });

    const status = await asAlice(
      `/attendance/status?workspaceId=${workspace.id}`,
    );
    expect(status.json.today).toMatchObject({
      status: "leave",
      leaveType: "sick",
    });

    const clockIn = await asAlice("/attendance/clock-in", {
      method: "POST",
      body: { workspaceId: workspace.id },
    });
    expect(clockIn.status).toBe(409);

    const team = await asManager(
      `/attendance/team?workspaceId=${workspace.id}&day=${today}`,
    );
    const aliceRow = team.json.find(
      (row: { userId: string }) => row.userId === alice.id,
    );
    expect(aliceRow.status).toBe("leave");

    const month = await asAlice(
      `/attendance/days?workspaceId=${workspace.id}&from=${today}&to=${today}`,
    );
    expect(month.json.totals.leaveDays).toBe(1);

    // The approver calls it off; Alice can work after all.
    const calledOff = await asManager(
      `/requests/leave/${requested.json.id}/cancel`,
      { method: "POST", body: { workspaceId: workspace.id } },
    );
    expect(calledOff.status).toBe(200);
    expect(
      (
        await asAlice("/attendance/clock-in", {
          method: "POST",
          body: { workspaceId: workspace.id },
        })
      ).status,
    ).toBe(200);

    const [audit] = await db
      .select()
      .from(schema.auditLogTable)
      .where(eq(schema.auditLogTable.action, "leave.cancelled"));
    expect(audit?.actorId).toBe(manager.id);
  });

  it("lets only approvers see everyone's leave, with who decided", async () => {
    const { workspace, alice, manager, today } = await company();
    const asAlice = requestAs(alice);
    const asManager = requestAs(manager);

    const preview = await asAlice(
      `/requests/leave/preview?workspaceId=${workspace.id}&startDate=${today}&endDate=${today}`,
    );
    expect(preview.json).toEqual({ days: 1 });

    const requested = await asAlice("/requests/leave", {
      method: "POST",
      body: {
        workspaceId: workspace.id,
        type: "annual",
        startDate: today,
        endDate: today,
      },
    });
    await asManager(`/requests/leave/${requested.json.id}/decide`, {
      method: "POST",
      body: {
        workspaceId: workspace.id,
        decision: "rejected",
        note: "Release week",
      },
    });

    expect(
      (await asAlice(`/requests/leave/all?workspaceId=${workspace.id}`))
        .status,
    ).toBe(403);

    const all = await asManager(
      `/requests/leave/all?workspaceId=${workspace.id}&status=rejected`,
    );
    expect(all.status).toBe(200);
    expect(all.json).toHaveLength(1);
    expect(all.json[0]).toMatchObject({
      userName: "Alice",
      decidedByName: "Mona",
      decisionNote: "Release week",
    });

    // Alice can't call off her own rejected request or someone else's.
    expect(
      (
        await asAlice(`/requests/leave/${requested.json.id}/cancel`, {
          method: "POST",
          body: { workspaceId: workspace.id },
        })
      ).status,
    ).toBe(409);
  });

  it("notifies approvers of a request and the person of the decision", async () => {
    const { owner, workspace, alice, manager, today } = await company();
    const asAlice = requestAs(alice);

    const requested = await asAlice("/requests/leave", {
      method: "POST",
      body: {
        workspaceId: workspace.id,
        type: "annual",
        startDate: today,
        endDate: today,
      },
    });

    const toManager = await notificationsFor(manager.id, "leave_requested");
    const toOwner = await notificationsFor(owner.id, "leave_requested");
    expect(toManager).toHaveLength(1);
    expect(toOwner).toHaveLength(1);
    // Never the person asking.
    expect(await notificationsFor(alice.id, "leave_requested")).toHaveLength(
      0,
    );

    await requestAs(manager)(`/requests/leave/${requested.json.id}/decide`, {
      method: "POST",
      body: { workspaceId: workspace.id, decision: "approved" },
    });
    const decided = await notificationsFor(alice.id, "leave_approved");
    expect(decided).toHaveLength(1);
    expect(decided[0]?.eventData).toMatchObject({ actorName: "Mona" });
  });
});

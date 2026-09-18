import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
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
  const bob = await addWorkspaceMember(workspace.id, "member", "Bob");
  const manager = await addWorkspaceMember(workspace.id, "manager", "Mona");
  return { owner, workspace, alice, bob, manager };
}

describe("salary", () => {
  it("keeps every salary record and shows pay only to the person and payroll readers", async () => {
    const { owner, workspace, alice, bob, manager } = await company();
    const asOwner = requestAs(owner);

    for (const [amount, effectiveFrom] of [
      [4_000_000, "2026-01-01"],
      [5_000_000, "2026-07-01"],
    ] as const) {
      const added = await asOwner("/pay/salaries", {
        method: "POST",
        body: {
          workspaceId: workspace.id,
          userId: alice.id,
          amount,
          type: "monthly",
          effectiveFrom,
        },
      });
      expect(added.status).toBe(200);
    }

    const history = await requestAs(alice)(
      `/pay/salaries?workspaceId=${workspace.id}`,
    );
    expect(history.json.map((s: { amount: number }) => s.amount)).toEqual([
      5_000_000, 4_000_000,
    ]);

    const query = `/pay/salaries?workspaceId=${workspace.id}&userId=${alice.id}`;
    expect((await requestAs(bob)(query)).status).toBe(403);
    // Managers run the team but do not see pay.
    expect((await requestAs(manager)(query)).status).toBe(403);
    expect(
      (
        await requestAs(manager)("/pay/salaries", {
          method: "POST",
          body: {
            workspaceId: workspace.id,
            userId: bob.id,
            amount: 1,
            type: "monthly",
            effectiveFrom: "2026-01-01",
          },
        })
      ).status,
    ).toBe(403);

    const audit = await db
      .select()
      .from(schema.auditLogTable)
      .where(eq(schema.auditLogTable.action, "salary.added"));
    expect(audit).toHaveLength(2);
  });
});

describe("payroll", () => {
  it("drafts, adjusts, approves and pays a month; payslips appear only once approved", async () => {
    const { owner, workspace, alice } = await company();
    const asOwner = requestAs(owner);
    const asAlice = requestAs(alice);

    await asOwner("/pay/salaries", {
      method: "POST",
      body: {
        workspaceId: workspace.id,
        userId: alice.id,
        amount: 5_000_000,
        type: "monthly",
        effectiveFrom: "2026-01-01",
      },
    });
    // One long day: 10:00–21:00 Dhaka on Thu 17 Sep = 2 hours overtime.
    await db.insert(schema.attendanceSessionTable).values({
      workspaceId: workspace.id,
      userId: alice.id,
      clockIn: new Date("2026-09-17T04:00:00Z"),
      clockOut: new Date("2026-09-17T15:00:00Z"),
    });

    const draft = await asOwner("/pay/runs", {
      method: "POST",
      body: { workspaceId: workspace.id, year: 2026, month: 9 },
    });
    expect(draft.json).toMatchObject({ status: "draft" });
    // Only Alice has a salary; the others are left out.
    expect(draft.json.items).toHaveLength(1);
    const line = draft.json.items[0];
    // 50,000 / 176 h × 2 h × 1.5 = 852.27 → 85,227 paisa.
    expect(line).toMatchObject({
      employeeName: "Alice",
      overtimeMinutes: 120,
      baseAmount: 5_000_000,
      overtimeAmount: 85_227,
      netAmount: 5_085_227,
    });

    expect(
      (
        await asOwner("/pay/runs", {
          method: "POST",
          body: { workspaceId: workspace.id, year: 2026, month: 9 },
        })
      ).status,
    ).toBe(409);

    const adjusted = await asOwner(
      `/pay/runs/${draft.json.id}/items/${line.id}`,
      {
        method: "PUT",
        body: {
          workspaceId: workspace.id,
          bonus: 300_000,
          deduction: 100_000,
          note: "Festival bonus",
        },
      },
    );
    expect(adjusted.json.items[0].netAmount).toBe(5_085_227 + 200_000);

    // Overtime starts at the automatic amount and can be set by hand; a
    // recalculation keeps the edit, and null puts the automatic amount back.
    expect(line).toMatchObject({
      overtimeRate: 42_614,
      overtimeAutoAmount: 85_227,
    });
    const lineUrl = `/pay/runs/${draft.json.id}/items/${line.id}`;
    const edited = await asOwner(lineUrl, {
      method: "PUT",
      body: {
        workspaceId: workspace.id,
        bonus: 300_000,
        deduction: 100_000,
        overtimeAmount: 100_000,
      },
    });
    expect(edited.json.items[0]).toMatchObject({
      overtimeAmount: 100_000,
      overtimeAutoAmount: 85_227,
      netAmount: 5_000_000 + 100_000 + 200_000,
    });
    const recalculated = await asOwner(
      `/pay/runs/${draft.json.id}/recalculate`,
      { method: "POST", body: { workspaceId: workspace.id } },
    );
    expect(recalculated.json.items[0].overtimeAmount).toBe(100_000);
    const reset = await asOwner(
      `/pay/runs/${draft.json.id}/items/${recalculated.json.items[0].id}`,
      {
        method: "PUT",
        body: {
          workspaceId: workspace.id,
          bonus: 300_000,
          deduction: 100_000,
          overtimeAmount: null,
        },
      },
    );
    expect(reset.json.items[0]).toMatchObject({
      overtimeAmount: 85_227,
      netAmount: 5_085_227 + 200_000,
    });

    // Drafts are not payslips yet.
    const before = await asAlice(`/pay/payslips?workspaceId=${workspace.id}`);
    expect(before.json).toEqual([]);

    // Paid only after approval.
    expect(
      (
        await asOwner(`/pay/runs/${draft.json.id}/paid`, {
          method: "POST",
          body: { workspaceId: workspace.id },
        })
      ).status,
    ).toBe(409);
    const approved = await asOwner(`/pay/runs/${draft.json.id}/approve`, {
      method: "POST",
      body: { workspaceId: workspace.id },
    });
    expect(approved.json.status).toBe("approved");

    // Approved payrolls are locked.
    expect(
      (
        await asOwner(`/pay/runs/${draft.json.id}/items/${line.id}`, {
          method: "PUT",
          body: { workspaceId: workspace.id, bonus: 0, deduction: 0 },
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await asOwner(
          `/pay/runs/${draft.json.id}?workspaceId=${workspace.id}`,
          {
            method: "DELETE",
          },
        )
      ).status,
    ).toBe(409);

    const paid = await asOwner(`/pay/runs/${draft.json.id}/paid`, {
      method: "POST",
      body: { workspaceId: workspace.id },
    });
    expect(paid.json.status).toBe("paid");

    const slips = await asAlice(`/pay/payslips?workspaceId=${workspace.id}`);
    expect(slips.json).toHaveLength(1);
    expect(slips.json[0]).toMatchObject({
      year: 2026,
      month: 9,
      currency: "BDT",
      bonus: 300_000,
      netAmount: 5_285_227,
    });

    const runs = await asOwner(`/pay/runs?workspaceId=${workspace.id}`);
    expect(runs.json[0]).toMatchObject({ people: 1, netTotal: 5_285_227 });

    const actions = (
      await db
        .select({ action: schema.auditLogTable.action })
        .from(schema.auditLogTable)
        .where(eq(schema.auditLogTable.targetType, "payroll_run"))
    ).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "payroll.created",
        "payroll.line_updated",
        "payroll.approved",
        "payroll.paid",
      ]),
    );
  });

  it("keeps payroll away from employees and managers", async () => {
    const { workspace, alice, manager } = await company();
    for (const user of [alice, manager]) {
      expect(
        (await requestAs(user)(`/pay/runs?workspaceId=${workspace.id}`)).status,
      ).toBe(403);
    }
  });
});

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
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
    annualLeaveDays: 18,
  });
  const alice = await addWorkspaceMember(workspace.id, "member", "Alice");
  const bob = await addWorkspaceMember(workspace.id, "member", "Bob");
  const manager = await addWorkspaceMember(workspace.id, "manager", "Mona");
  return { owner, workspace, alice, bob, manager };
}

// A 1×1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

describe("leave", () => {
  it("counts working days, blocks overlaps, and is decided by someone else", async () => {
    const { workspace, alice, manager } = await company();
    const asAlice = requestAs(alice);

    // Thu 17 Sep – Sun 20 Sep 2026: Thu and Sun are work days, Fri/Sat are off.
    const requested = await asAlice("/requests/leave", {
      method: "POST",
      body: {
        workspaceId: workspace.id,
        type: "annual",
        startDate: "2026-09-17",
        endDate: "2026-09-20",
        reason: "Family visit",
      },
    });
    expect(requested.status).toBe(200);
    expect(requested.json.days).toBe(2);

    expect(
      (
        await asAlice("/requests/leave", {
          method: "POST",
          body: {
            workspaceId: workspace.id,
            type: "sick",
            startDate: "2026-09-20",
            endDate: "2026-09-21",
          },
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await asAlice("/requests/leave", {
          method: "POST",
          body: {
            workspaceId: workspace.id,
            type: "annual",
            startDate: "2026-09-18",
            endDate: "2026-09-19",
          },
        })
      ).status,
    ).toBe(400);

    const pendingBalance = await asAlice(
      `/requests/leave/balance?workspaceId=${workspace.id}&year=2026`,
    );
    expect(pendingBalance.json).toEqual({
      year: 2026,
      allowance: 18,
      used: 0,
      pending: 2,
      available: 18,
    });

    // Employees cannot approve, and approvers cannot approve their own.
    expect(
      (
        await asAlice(`/requests/leave/${requested.json.id}/decide`, {
          method: "POST",
          body: { workspaceId: workspace.id, decision: "approved" },
        })
      ).status,
    ).toBe(403);

    const asManager = requestAs(manager);
    const open = await asManager(`/requests/open?workspaceId=${workspace.id}`);
    expect(open.json.leave).toHaveLength(1);

    const approved = await asManager(
      `/requests/leave/${requested.json.id}/decide`,
      {
        method: "POST",
        body: { workspaceId: workspace.id, decision: "approved" },
      },
    );
    expect(approved.json.status).toBe("approved");

    const balance = await asAlice(
      `/requests/leave/balance?workspaceId=${workspace.id}&year=2026`,
    );
    expect(balance.json).toMatchObject({ used: 2, pending: 0, available: 16 });

    const own = await asManager("/requests/leave", {
      method: "POST",
      body: {
        workspaceId: workspace.id,
        type: "annual",
        startDate: "2026-10-04",
        endDate: "2026-10-04",
      },
    });
    expect(
      (
        await asManager(`/requests/leave/${own.json.id}/decide`, {
          method: "POST",
          body: { workspaceId: workspace.id, decision: "approved" },
        })
      ).status,
    ).toBe(403);

    const audit = await db
      .select()
      .from(schema.auditLogTable)
      .where(eq(schema.auditLogTable.action, "leave.approved"));
    expect(audit).toHaveLength(1);
  });
});

describe("expenses", () => {
  it("submits with a receipt, gets approved, and is paid by payroll", async () => {
    const { owner, workspace, alice, bob, manager } = await company();
    const asAlice = requestAs(alice);

    const receipt = await asAlice("/requests/receipts", {
      method: "POST",
      body: {
        workspaceId: workspace.id,
        filename: "taxi.png",
        data: PNG.toString("base64"),
      },
    });
    expect(receipt.json).toMatchObject({ mimeType: "image/png" });

    const expense = await asAlice("/requests/expenses", {
      method: "POST",
      body: {
        workspaceId: workspace.id,
        amount: 45_000,
        category: "Travel",
        description: "Taxi to client",
        spentOn: "2026-09-16",
        receiptFileId: receipt.json.id,
      },
    });
    expect(expense.json).toMatchObject({
      currency: "BDT",
      status: "pending",
      receiptName: "taxi.png",
    });

    // Bob cannot see Alice's receipt; the approver can.
    const { app } = createApp();
    const download = async (user: typeof alice) => {
      mockAuthenticatedSession(user);
      return app.request(
        `/api/requests/receipts/${receipt.json.id}?workspaceId=${workspace.id}`,
      );
    };
    expect((await download(bob)).status).toBe(403);
    const seen = await download(manager);
    expect(seen.status).toBe(200);
    expect(seen.headers.get("content-type")).toBe("image/png");
    expect(seen.headers.get("x-content-type-options")).toBe("nosniff");

    const approved = await requestAs(manager)(
      `/requests/expenses/${expense.json.id}/decide`,
      {
        method: "POST",
        body: { workspaceId: workspace.id, decision: "approved" },
      },
    );
    expect(approved.json.status).toBe("approved");

    // Managers approve but do not pay out.
    expect(
      (
        await requestAs(manager)(`/requests/expenses/${expense.json.id}/paid`, {
          method: "POST",
          body: { workspaceId: workspace.id },
        })
      ).status,
    ).toBe(403);
    const paid = await requestAs(owner)(
      `/requests/expenses/${expense.json.id}/paid`,
      { method: "POST", body: { workspaceId: workspace.id } },
    );
    expect(paid.json.status).toBe("paid");
  });

  it("refuses a file that is not an image or PDF, even if named like one", async () => {
    const { workspace, alice } = await company();
    const response = await requestAs(alice)("/requests/receipts", {
      method: "POST",
      body: {
        workspaceId: workspace.id,
        filename: "receipt.png",
        data: Buffer.from("<html><script>alert(1)</script></html>").toString(
          "base64",
        ),
      },
    });
    expect(response.status).toBe(400);
  });

  it("does not let someone attach another person's receipt", async () => {
    const { workspace, alice, bob } = await company();
    const receipt = await requestAs(alice)("/requests/receipts", {
      method: "POST",
      body: {
        workspaceId: workspace.id,
        filename: "mine.png",
        data: PNG.toString("base64"),
      },
    });
    const response = await requestAs(bob)("/requests/expenses", {
      method: "POST",
      body: {
        workspaceId: workspace.id,
        amount: 100,
        category: "Food",
        spentOn: "2026-09-16",
        receiptFileId: receipt.json.id,
      },
    });
    expect(response.status).toBe(400);
  });
});

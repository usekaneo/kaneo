import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { addWorkspaceMember, requestAs } from "./helpers/company";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
});

describe("everyone's expenses", () => {
  it("lists every person's expenses for approvers, filtered by spend date and status", async () => {
    const { user: owner, workspace } = await createWorkspaceMember({
      role: "owner",
    });
    const alice = await addWorkspaceMember(workspace.id, "member", "Alice");
    const bob = await addWorkspaceMember(workspace.id, "member", "Bob");
    const expense = (
      userId: string,
      spentOn: string,
      amount: number,
      status = "pending",
    ) => ({
      workspaceId: workspace.id,
      userId,
      amount,
      currency: "USD",
      category: "Travel",
      spentOn,
      status,
    });
    await db
      .insert(schema.expenseTable)
      .values([
        expense(alice.id, "2026-09-03", 1500),
        expense(bob.id, "2026-09-20", 4200, "approved"),
        expense(bob.id, "2026-08-31", 900),
      ]);

    const september = await requestAs(owner)(
      `/requests/expenses/all?workspaceId=${workspace.id}&from=2026-09-01&to=2026-09-30`,
    );
    expect(september.status).toBe(200);
    expect(
      september.json.map((e: { userName: string; amount: number }) => [
        e.userName,
        e.amount,
      ]),
    ).toEqual([
      ["Bob", 4200],
      ["Alice", 1500],
    ]);

    const approved = await requestAs(owner)(
      `/requests/expenses/all?workspaceId=${workspace.id}&status=approved`,
    );
    expect(approved.json).toHaveLength(1);

    const asMember = await requestAs(alice)(
      `/requests/expenses/all?workspaceId=${workspace.id}`,
    );
    expect(asMember.status).toBe(403);
  });
});

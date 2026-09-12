import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const { updateSubscriptionSeats } = vi.hoisted(() => ({
  updateSubscriptionSeats: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("../../apps/api/src/billing/creem-client", () => ({
  updateSubscriptionSeats,
  createCheckoutSession: vi.fn(),
  createCustomerPortalLink: vi.fn(),
}));

import { syncWorkspaceSeats } from "../../apps/api/src/billing/controllers/sync-seats";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const CLOUD_ENV = {
  KANEO_CLOUD: "true",
  CREEM_API_KEY: "creem_test_dummy",
  CREEM_WEBHOOK_SECRET: "whsec_dummy",
};
const saved: Record<string, string | undefined> = {};

async function addMember(workspaceId: string) {
  const member = await createWorkspaceMember();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: member.user.id,
    role: "member",
    joinedAt: new Date(),
  });
}

async function teamBilling(workspaceId: string, seats: number) {
  await db.insert(schema.workspaceBillingTable).values({
    workspaceId,
    plan: "team",
    status: "active",
    seats,
    creemSubscriptionId: `sub-${workspaceId}`,
    creemProductId: "prod_team_monthly",
  });
}

describe("API integration: seat sync", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(CLOUD_ENV)) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
  });
  afterAll(() => {
    for (const k of Object.keys(CLOUD_ENV)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
  beforeEach(async () => {
    await resetTestDatabase();
    updateSubscriptionSeats.mockClear();
  });

  it("updates Creem and persists the new seat count when members change", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    await teamBilling(owner.workspace.id, 1);
    await addMember(owner.workspace.id); // now 2 members

    await syncWorkspaceSeats(owner.workspace.id);

    expect(updateSubscriptionSeats).toHaveBeenCalledWith({
      subscriptionId: `sub-${owner.workspace.id}`,
      productId: "prod_team_monthly",
      units: 2,
    });
    const [row] = await db
      .select()
      .from(schema.workspaceBillingTable)
      .where(eq(schema.workspaceBillingTable.workspaceId, owner.workspace.id));
    expect(row.seats).toBe(2);
  });

  it("does nothing when the seat count already matches", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    await teamBilling(owner.workspace.id, 1); // 1 member, seats already 1

    await syncWorkspaceSeats(owner.workspace.id);
    expect(updateSubscriptionSeats).not.toHaveBeenCalled();
  });

  it("skips personal plans", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    await db.insert(schema.workspaceBillingTable).values({
      workspaceId: owner.workspace.id,
      plan: "personal",
      status: "active",
      seats: 1,
      creemSubscriptionId: `sub-${owner.workspace.id}`,
      creemProductId: "prod_personal_monthly",
    });
    await addMember(owner.workspace.id);

    await syncWorkspaceSeats(owner.workspace.id);
    expect(updateSubscriptionSeats).not.toHaveBeenCalled();
  });

  it("skips workspaces without an active subscription", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    await db.insert(schema.workspaceBillingTable).values({
      workspaceId: owner.workspace.id,
      plan: "team",
      status: "canceled",
      seats: 1,
      creemSubscriptionId: `sub-${owner.workspace.id}`,
      creemProductId: "prod_team_monthly",
    });
    await addMember(owner.workspace.id);

    await syncWorkspaceSeats(owner.workspace.id);
    expect(updateSubscriptionSeats).not.toHaveBeenCalled();
  });
});

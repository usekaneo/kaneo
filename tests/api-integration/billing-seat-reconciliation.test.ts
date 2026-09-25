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

import db, { schema } from "../../apps/api/src/database";
import { reconcileWorkspaceSeats } from "../../apps/api/src/scheduler/seat-reconciliation";
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

async function billing(
  workspaceId: string,
  overrides: Partial<typeof schema.workspaceBillingTable.$inferInsert> = {},
) {
  await db.insert(schema.workspaceBillingTable).values({
    workspaceId,
    plan: "team",
    status: "active",
    seats: 1,
    creemSubscriptionId: `sub-${workspaceId}`,
    creemProductId: "prod_team_monthly",
    ...overrides,
  });
}

async function seatsOf(workspaceId: string) {
  const [row] = await db
    .select()
    .from(schema.workspaceBillingTable)
    .where(eq(schema.workspaceBillingTable.workspaceId, workspaceId));
  return row.seats;
}

describe("API integration: seat reconciliation", () => {
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
    updateSubscriptionSeats.mockImplementation(async () => ({
      ok: true as const,
    }));
  });

  it("repairs a workspace whose seat count drifted from its membership", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    await billing(owner.workspace.id, { seats: 1 });
    await addMember(owner.workspace.id);
    await addMember(owner.workspace.id); // 3 members, still billed for 1

    await reconcileWorkspaceSeats();

    expect(updateSubscriptionSeats).toHaveBeenCalledWith({
      subscriptionId: `sub-${owner.workspace.id}`,
      productId: "prod_team_monthly",
      units: 3,
    });
    expect(await seatsOf(owner.workspace.id)).toBe(3);
  });

  it("repairs drift downwards after members leave", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    await billing(owner.workspace.id, { seats: 5 });

    await reconcileWorkspaceSeats();

    expect(updateSubscriptionSeats).toHaveBeenCalledWith(
      expect.objectContaining({ units: 1 }),
    );
    expect(await seatsOf(owner.workspace.id)).toBe(1);
  });

  it("touches nothing when every workspace is already in sync", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    await billing(owner.workspace.id, { seats: 1 });

    await reconcileWorkspaceSeats();

    expect(updateSubscriptionSeats).not.toHaveBeenCalled();
  });

  it("ignores personal plans and inactive subscriptions", async () => {
    const personal = await createWorkspaceMember({ role: "owner" });
    await billing(personal.workspace.id, { plan: "personal", seats: 9 });

    const canceled = await createWorkspaceMember({ role: "owner" });
    await billing(canceled.workspace.id, { status: "canceled", seats: 9 });

    await reconcileWorkspaceSeats();

    expect(updateSubscriptionSeats).not.toHaveBeenCalled();
  });

  it("keeps going when one workspace fails to sync", async () => {
    const first = await createWorkspaceMember({ role: "owner" });
    await billing(first.workspace.id, { seats: 4 });
    const second = await createWorkspaceMember({ role: "owner" });
    await billing(second.workspace.id, { seats: 4 });

    updateSubscriptionSeats.mockImplementationOnce(async () => {
      throw new Error("provider unavailable");
    });

    await expect(reconcileWorkspaceSeats()).resolves.toEqual({
      degraded: true,
    });

    expect(updateSubscriptionSeats).toHaveBeenCalledTimes(2);
    const seats = [
      await seatsOf(first.workspace.id),
      await seatsOf(second.workspace.id),
    ].sort();
    expect(seats).toEqual([1, 4]);
  });
});

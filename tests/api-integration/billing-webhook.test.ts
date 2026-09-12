import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { planForProductId } = vi.hoisted(() => ({
  planForProductId: vi.fn(() => ({
    plan: "team" as const,
    interval: "monthly" as const,
  })),
}));
vi.mock("../../apps/api/src/billing/config", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../apps/api/src/billing/config")>();
  return { ...actual, planForProductId };
});

import handleWebhook, {
  type BillingWebhookEvent,
} from "../../apps/api/src/billing/controllers/handle-webhook";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const PERIOD_END = new Date("2026-09-01T00:00:00.000Z");

async function seedBilling(
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
    currentPeriodEnd: PERIOD_END,
    ...overrides,
  });
}

async function readBilling(workspaceId: string) {
  const [row] = await db
    .select()
    .from(schema.workspaceBillingTable)
    .where(eq(schema.workspaceBillingTable.workspaceId, workspaceId));
  return row;
}

function subscriptionEvent(
  id: string,
  workspaceId: string,
  data: Record<string, unknown> = {},
): BillingWebhookEvent {
  return {
    id,
    type: "subscription.canceled",
    data: {
      id: `sub-${workspaceId}`,
      status: "canceled",
      product: { id: "prod_team_monthly" },
      ...data,
    },
  };
}

describe("API integration: billing webhooks", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    planForProductId.mockClear();
  });

  it("applies a subscription event once and suppresses the replay", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    await seedBilling(owner.workspace.id);
    const event = subscriptionEvent("evt-dup", owner.workspace.id);

    expect(await handleWebhook(event)).toEqual({
      processed: true,
      duplicate: false,
    });
    expect(await handleWebhook(event)).toEqual({
      processed: false,
      duplicate: true,
    });

    expect((await readBilling(owner.workspace.id)).status).toBe("canceled");
  });

  it("leaves the event replayable when applying it fails", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    await seedBilling(owner.workspace.id);
    const event = subscriptionEvent("evt-fail", owner.workspace.id);

    planForProductId.mockImplementationOnce(() => {
      throw new Error("apply failed");
    });
    await expect(handleWebhook(event)).rejects.toThrow("apply failed");

    expect(await db.select().from(schema.billingEventTable)).toHaveLength(0);
    expect((await readBilling(owner.workspace.id)).status).toBe("active");

    expect(await handleWebhook(event)).toEqual({
      processed: true,
      duplicate: false,
    });
    expect((await readBilling(owner.workspace.id)).status).toBe("canceled");
  });

  it("keeps a known period end when a later event omits it", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    await seedBilling(owner.workspace.id);

    await handleWebhook({
      id: "evt-paid",
      type: "subscription.paid",
      data: { id: `sub-${owner.workspace.id}`, status: "active" },
    });

    expect((await readBilling(owner.workspace.id)).currentPeriodEnd).toEqual(
      PERIOD_END,
    );
  });

  it("keeps a recorded cancellation when a later event omits it", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const canceledAt = new Date("2026-08-20T00:00:00.000Z");
    await seedBilling(owner.workspace.id, { canceledAt });

    await handleWebhook({
      id: "evt-active",
      type: "subscription.active",
      data: { id: `sub-${owner.workspace.id}`, status: "active" },
    });

    expect((await readBilling(owner.workspace.id)).canceledAt).toEqual(
      canceledAt,
    );
  });

  it("clears the cancellation when the provider sends an explicit null", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    await seedBilling(owner.workspace.id, {
      canceledAt: new Date("2026-08-20T00:00:00.000Z"),
    });

    await handleWebhook({
      id: "evt-resumed",
      type: "subscription.active",
      data: {
        id: `sub-${owner.workspace.id}`,
        status: "active",
        canceled_at: null,
      },
    });

    expect((await readBilling(owner.workspace.id)).canceledAt).toBeNull();
  });
});

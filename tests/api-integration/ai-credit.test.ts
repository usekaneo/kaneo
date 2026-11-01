import * as creemClient from "../../apps/api/src/billing/creem-client";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import {
  readWallet,
  reserveCredit,
  settleCredit,
} from "../../apps/api/src/billing/ai/wallet";
import handleWebhook from "../../apps/api/src/billing/controllers/handle-webhook";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { aiBillingRoutes } from "../../apps/api/src/billing/ai/routes";
import { apiRouter, type BaseVariables } from "../../apps/api/src/openapi";
import { meteredModel } from "../../apps/api/src/billing/ai/metered-model";
import { MockLanguageModelV3 } from "ai/test";

const USD = 1000000n;
async function seedPurchase(cents = 500) {
  const owner = await createWorkspaceMember({ role: "owner" });
  await readWallet(owner.workspace.id);
  const [purchase] = await db
    .insert(schema.aiTopupTable)
    .values({
      workspaceId: owner.workspace.id,
      userId: owner.user.id,
      cents,
      productId: "prod_ai_500",
      requestId: randomUUID(),
    })
    .returning();
  const data = {
    id: "checkout_1",
    status: "completed",
    requestId: purchase!.id,
    metadata: {
      workspaceId: owner.workspace.id,
      aiTopupId: purchase!.id,
      purchaseType: "ai_topup",
    },
    product: { id: "prod_ai_500" },
    order: {
      id: "order_1",
      transaction: "transaction_1",
      status: "paid",
      amount: cents,
      amountPaid: cents === 500 ? 600 : cents,
      currency: "USD",
      product: "prod_ai_500",
    },
  };
  return { owner, purchase: purchase!, data };
}

beforeEach(async () => {
  await resetTestDatabase();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AI prepaid wallet", () => {
  it("grants $1 exactly once across concurrent requests", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const wallets = await Promise.all(
      Array.from({ length: 8 }, () => readWallet(owner.workspace.id)),
    );
    expect(
      wallets.every((wallet) => wallet.balanceMicroUsd === String(USD)),
    ).toBe(true);
    expect(await db.select().from(schema.aiLedgerTable)).toHaveLength(1);
  });
  it("retains normalized email claims across deletion and re-registration", async () => {
    const first = await createWorkspaceMember({ role: "owner" });
    await db
      .update(schema.userTable)
      .set({ email: "owner+first@example.com" })
      .where(eq(schema.userTable.id, first.user.id));
    await readWallet(first.workspace.id);
    await db
      .delete(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, first.workspace.id));
    await db
      .delete(schema.userTable)
      .where(eq(schema.userTable.id, first.user.id));
    const second = await createWorkspaceMember({ role: "owner" });
    await db
      .update(schema.userTable)
      .set({ email: "OWNER+second@example.com" })
      .where(eq(schema.userTable.id, second.user.id));
    expect((await readWallet(second.workspace.id)).balanceMicroUsd).toBe("0");
  });
  it("does not grant to unverified owners, and grants after verification", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    await db
      .update(schema.userTable)
      .set({ emailVerified: false })
      .where(eq(schema.userTable.id, owner.user.id));
    expect((await readWallet(owner.workspace.id)).trialGranted).toBe(false);
    await db
      .update(schema.userTable)
      .set({ emailVerified: true })
      .where(eq(schema.userTable.id, owner.user.id));
    expect((await readWallet(owner.workspace.id)).balanceMicroUsd).toBe(
      String(USD),
    );
  });
  it("serializes competing reservations and settles once", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const input = {
      workspaceId: owner.workspace.id,
      runId: "run_1",
      model: "model",
      amount: 750000n,
      multiplierBps: 15000,
    };
    const results = await Promise.allSettled([
      reserveCredit(input),
      reserveCredit(input),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const reservation = results.find(
      (result) => result.status === "fulfilled",
    )!;
    if (reservation.status !== "fulfilled")
      throw new Error("missing reservation");
    await Promise.all([
      settleCredit(reservation.value.id, 123456n),
      settleCredit(reservation.value.id, 123456n),
    ]);
    expect(await readWallet(owner.workspace.id)).toMatchObject({
      balanceMicroUsd: "876544",
      reservedMicroUsd: "0",
    });
    expect(
      await db
        .select()
        .from(schema.aiLedgerTable)
        .where(eq(schema.aiLedgerTable.kind, "usage")),
    ).toHaveLength(1);
  });
  it("records upstream overruns as debt and blocks further calls", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const input = {
      workspaceId: owner.workspace.id,
      runId: "run_1",
      model: "model",
      amount: USD,
      multiplierBps: 15000,
    };
    const reservation = await reserveCredit(input);
    await settleCredit(reservation.id, USD + 1n);
    expect((await readWallet(owner.workspace.id)).availableMicroUsd).toBe("-1");
    await expect(reserveCredit({ ...input, amount: 1n })).rejects.toMatchObject(
      { status: 402 },
    );
  });
});

describe("Creem AI credit", () => {
  it("credits a purchase once across distinct event IDs without changing subscriptions", async () => {
    const { owner, data } = await seedPurchase();
    await db.insert(schema.workspaceBillingTable).values({
      workspaceId: owner.workspace.id,
      plan: "team",
      status: "active",
      creemSubscriptionId: "sub_existing",
    });
    await Promise.all([
      handleWebhook({ id: "evt_1", type: "checkout.completed", data }),
      handleWebhook({ id: "evt_2", type: "checkout.completed", data }),
    ]);
    expect((await readWallet(owner.workspace.id)).balanceMicroUsd).toBe(
      "6000000",
    );
    expect(
      (await db.query.workspaceBillingTable.findFirst())?.creemSubscriptionId,
    ).toBe("sub_existing");
    expect(
      await db
        .select()
        .from(schema.aiLedgerTable)
        .where(eq(schema.aiLedgerTable.kind, "topup")),
    ).toHaveLength(1);
  });
  it("rejects mismatched payments and leaves failed events retryable", async () => {
    const { owner, data } = await seedPurchase();
    const bad = { ...data, order: { ...data.order, amount: 100 } };
    await expect(
      handleWebhook({ id: "evt_bad", type: "checkout.completed", data: bad }),
    ).rejects.toThrow("does not match");
    expect((await readWallet(owner.workspace.id)).balanceMicroUsd).toBe(
      String(USD),
    );
    expect(await db.select().from(schema.billingEventTable)).toHaveLength(0);
    await handleWebhook({ id: "evt_bad", type: "checkout.completed", data });
    expect((await readWallet(owner.workspace.id)).balanceMicroUsd).toBe(
      "6000000",
    );
  });
  it("credits the exact custom amount and rejects a payment changed to the product base price", async () => {
    const { owner, data } = await seedPurchase(1234);
    await expect(
      handleWebhook({
        id: "evt_custom",
        type: "checkout.completed",
        data: {
          ...data,
          order: { ...data.order, amount: 500, amountPaid: 500 },
        },
      }),
    ).rejects.toThrow("does not match");
    await handleWebhook({ id: "evt_custom", type: "checkout.completed", data });
    expect((await readWallet(owner.workspace.id)).balanceMicroUsd).toBe(
      "13340000",
    );
  });
  it("handles partial refunds including tax proportionally and deduplicates refund IDs", async () => {
    const { owner, data } = await seedPurchase();
    await handleWebhook({ id: "evt_paid", type: "checkout.completed", data });
    const refund = {
      id: "refund_1",
      status: "succeeded",
      transaction: { id: "transaction_1" },
      refundAmount: 300,
      refundCurrency: "USD",
    };
    await handleWebhook({
      id: "evt_refund",
      type: "refund.created",
      data: refund,
    });
    await handleWebhook({
      id: "evt_refund_again",
      type: "refund.created",
      data: refund,
    });
    expect((await readWallet(owner.workspace.id)).balanceMicroUsd).toBe(
      "3500000",
    );
  });
  it("rounds cumulative partial refunds once rather than revoking an extra cent per refund", async () => {
    const { owner, data } = await seedPurchase();
    await handleWebhook({ id: "evt_paid", type: "checkout.completed", data });
    for (let index = 0; index < 10; index++) {
      await handleWebhook({
        id: `evt_small_refund_${index}`,
        type: "refund.created",
        data: {
          id: `refund_${index}`,
          status: "succeeded",
          transaction: { id: "transaction_1" },
          refundAmount: 1,
          refundCurrency: "USD",
        },
      });
    }
    expect((await readWallet(owner.workspace.id)).balanceMicroUsd).toBe(
      "5910000",
    );
  });
  it("applies a refund received before checkout completion", async () => {
    const { owner, data } = await seedPurchase();
    await handleWebhook({
      id: "evt_refund_first",
      type: "refund.created",
      data: {
        id: "refund_1",
        status: "succeeded",
        transaction: { id: "transaction_1" },
        refund_amount: 600,
        refund_currency: "USD",
      },
    });
    await handleWebhook({
      id: "evt_paid_late",
      type: "checkout.completed",
      data,
    });
    expect((await readWallet(owner.workspace.id)).balanceMicroUsd).toBe(
      String(USD),
    );
  });
});

function routes(userId: string) {
  const app = apiRouter<BaseVariables>();
  app.use("*", async (c, next) => {
    c.set("userId", userId);
    c.set("userEmail", "owner@example.com");
    const user = await db.query.userTable.findFirst({
      where: eq(schema.userTable.id, userId),
    });
    c.set("user", user!);
    c.set("session", {
      id: `session-${userId}`,
      token: "test-session",
      userId,
      expiresAt: new Date(Date.now() + 60000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await next();
  });
  return app.route("/", aiBillingRoutes);
}
describe("AI credit authorization", () => {
  it("hides other workspaces and rejects non-admin purchases", async () => {
    vi.stubEnv("KANEO_CLOUD", "true");
    const owner = await createWorkspaceMember({ role: "owner" });
    const outsider = await createWorkspaceMember({ role: "member" });
    expect(
      (await routes(outsider.user.id).request(`/${owner.workspace.id}/ai`))
        .status,
    ).toBe(404);
    expect(
      (
        await routes(outsider.user.id).request(
          `/${outsider.workspace.id}/ai/topups`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ cents: 500, requestId: randomUUID() }),
          },
        )
      ).status,
    ).toBe(403);
    expect(await db.select().from(schema.aiTopupTable)).toHaveLength(0);
  });
  it.each([500, 1234, 1999])(
    "creates one checkout for concurrent retries at %s cents and grants nothing before payment",
    async (cents) => {
      vi.stubEnv("KANEO_CLOUD", "true");
      vi.stubEnv("CREEM_API_KEY", "test-key");
      vi.stubEnv("CREEM_WEBHOOK_SECRET", "test-secret");
      vi.stubEnv("CREEM_PRODUCT_AI_CREDIT", "prod_ai_credit");
      const owner = await createWorkspaceMember({ role: "owner" });
      const checkout = vi
        .spyOn(creemClient, "createCheckoutSession")
        .mockResolvedValue({
          checkoutId: "checkout_managed",
          checkoutUrl: "https://test-checkout.creem.io/test",
        });
      const app = routes(owner.user.id);
      const request = () =>
        app.request(`/${owner.workspace.id}/ai/topups`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            cents,
            requestId: "54af29d6-c2ca-441d-85a4-03dd35f1dacf",
          }),
        });
      const responses = await Promise.all([request(), request()]);
      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      expect(checkout).toHaveBeenCalledTimes(1);
      expect((await readWallet(owner.workspace.id)).balanceMicroUsd).toBe(
        String(USD),
      );
      const [purchase] = await db.select().from(schema.aiTopupTable);
      expect(checkout).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: purchase!.id,
          customPrice: cents,
          metadata: expect.objectContaining({ aiTopupId: purchase!.id }),
        }),
      );
    },
  );
  it.each([499, 0, -500, 500.5, 100000000])(
    "rejects invalid custom top-up amount %s before checkout",
    async (cents) => {
      vi.stubEnv("KANEO_CLOUD", "true");
      const owner = await createWorkspaceMember({ role: "owner" });
      const checkout = vi.spyOn(creemClient, "createCheckoutSession");
      const response = await routes(owner.user.id).request(
        `/${owner.workspace.id}/ai/topups`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cents, requestId: randomUUID() }),
        },
      );
      expect(response.status).toBe(400);
      expect(checkout).not.toHaveBeenCalled();
      expect(await db.select().from(schema.aiTopupTable)).toHaveLength(0);
    },
  );
  it("leaves self-hosted credit uninitialized", async () => {
    vi.stubEnv("KANEO_CLOUD", "false");
    const owner = await createWorkspaceMember({ role: "owner" });
    const response = await routes(owner.user.id).request(
      `/${owner.workspace.id}/ai`,
    );
    expect(response.status).toBe(200);
    expect((await response.json()).enabled).toBe(false);
    expect(await db.select().from(schema.aiWalletTable)).toHaveLength(0);
  });
});

describe("AI inference metering", () => {
  it("reserves before inference, settles all calls and rejects a depleted balance before contacting the model", async () => {
    vi.stubEnv("KANEO_CLOUD", "true");
    const owner = await createWorkspaceMember({ role: "owner" });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: [
                {
                  id: "test/model",
                  context_length: 1000,
                  pricing: { prompt: "0.000001", completion: "0.000001" },
                },
              ],
            }),
          ),
      ),
    );
    const underlying = new MockLanguageModelV3({
      doStream: async () => {
        const wallet = await readWallet(owner.workspace.id);
        expect(BigInt(wallet.reservedMicroUsd)).toBeGreaterThan(0n);
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "response-metadata", id: "gen-1" });
              controller.enqueue({
                type: "finish",
                finishReason: { unified: "stop", raw: "stop" },
                usage: {
                  inputTokens: {
                    total: 1,
                    noCache: 1,
                    cacheRead: 0,
                    cacheWrite: 0,
                  },
                  outputTokens: { total: 1, text: 1, reasoning: 0 },
                },
                providerMetadata: { openrouter: { usage: { cost: 0.25 } } },
              });
              controller.close();
            },
          }),
        };
      },
    });
    const wrapped = await meteredModel(underlying, {
      workspaceId: owner.workspace.id,
      runId: "run-1",
      model: "openrouter:test/model",
      maxOutputTokens: 256,
    });
    if (typeof wrapped === "string" || !("doStream" in wrapped))
      throw new Error("missing wrapped model");
    const result = await wrapped.doStream({ prompt: [] });
    for await (const _chunk of result.stream) {
      /* consume terminal accounting */
    }
    expect(await readWallet(owner.workspace.id)).toMatchObject({
      balanceMicroUsd: "625000",
      reservedMicroUsd: "0",
    });
    await db
      .update(schema.aiWalletTable)
      .set({ balance: 0n })
      .where(eq(schema.aiWalletTable.workspaceId, owner.workspace.id));
    await expect(wrapped.doStream({ prompt: [] })).rejects.toMatchObject({
      status: 402,
    });
    expect(underlying.doStreamCalls).toHaveLength(1);
  });
});

describe("AI interrupted inference", () => {
  it("retains credit when a request fails with an unknown upstream cost", async () => {
    vi.stubEnv("KANEO_CLOUD", "true");
    const owner = await createWorkspaceMember({ role: "owner" });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: [
                {
                  id: "test/model",
                  context_length: 1000,
                  pricing: { prompt: "0.000001", completion: "0.000001" },
                },
              ],
            }),
          ),
      ),
    );
    const underlying = new MockLanguageModelV3({
      doStream: async () => {
        throw new Error("network interrupted");
      },
    });
    const wrapped = await meteredModel(underlying, {
      workspaceId: owner.workspace.id,
      runId: "run-interrupted",
      model: "openrouter:test/model",
      maxOutputTokens: 256,
    });
    if (typeof wrapped === "string" || !("doStream" in wrapped))
      throw new Error("missing wrapped model");
    await expect(wrapped.doStream({ prompt: [] })).rejects.toThrow(
      "network interrupted",
    );
    const wallet = await readWallet(owner.workspace.id);
    expect(wallet.balanceMicroUsd).toBe(String(USD));
    expect(BigInt(wallet.reservedMicroUsd)).toBeGreaterThan(0n);
    expect((await db.select().from(schema.aiReservationTable))[0]!.status).toBe(
      "held",
    );
  });
});

describe("Cloud AI cost reconciliation", () => {
  it("settles interrupted requests from provider generation accounting", async () => {
    vi.stubEnv("KANEO_CLOUD", "true");
    vi.stubEnv("OPENROUTER_API_KEY", "test-only-provider-key");
    const owner = await createWorkspaceMember({ role: "owner" });
    const reservation = await reserveCredit({
      workspaceId: owner.workspace.id,
      runId: "run-reconcile",
      model: "test/model",
      amount: 500000n,
      multiplierBps: 15000,
    });
    await db
      .update(schema.aiReservationTable)
      .set({
        generationId: "gen-reconcile",
        createdAt: new Date(Date.now() - 700000),
      })
      .where(eq(schema.aiReservationTable.id, reservation.id));
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: {
                id: "gen-reconcile",
                total_cost: 0.2,
                generation_time: 100,
              },
            }),
          ),
      ),
    );
    const { reconcileAiCredit } =
      await import("../../apps/api/src/billing/ai/reconcile");
    await reconcileAiCredit();
    expect(await readWallet(owner.workspace.id)).toMatchObject({
      balanceMicroUsd: "700000",
      reservedMicroUsd: "0",
    });
  });
});

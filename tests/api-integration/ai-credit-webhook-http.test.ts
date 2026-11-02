import { createHmac, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import billing from "../../apps/api/src/billing";
import { readWallet } from "../../apps/api/src/billing/ai/wallet";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const secret = "local-webhook-fixture-only";
let server: ReturnType<typeof serve>;
let endpoint: string;

beforeAll(async () => {
  server = serve({ fetch: billing.fetch, hostname: "127.0.0.1", port: 0 });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/webhook`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
beforeEach(async () => {
  await resetTestDatabase();
  vi.stubEnv("KANEO_CLOUD", "true");
  vi.stubEnv("CREEM_API_KEY", "local-fixture-key");
  vi.stubEnv("CREEM_WEBHOOK_SECRET", secret);
});
afterEach(() => vi.unstubAllEnvs());

async function purchase() {
  const owner = await createWorkspaceMember({ role: "owner" });
  await readWallet(owner.workspace.id);
  const [topup] = await db
    .insert(schema.aiTopupTable)
    .values({
      workspaceId: owner.workspace.id,
      userId: owner.user.id,
      cents: 1234,
      productId: "prod_local_ai",
      requestId: randomUUID(),
    })
    .returning();
  const object = {
    id: "checkout_local",
    status: "completed",
    request_id: topup!.id,
    metadata: {
      workspaceId: owner.workspace.id,
      aiTopupId: topup!.id,
      purchaseType: "ai_topup",
    },
    product: "prod_local_ai",
    order: {
      id: "order_local",
      status: "paid",
      amount: 1234,
      amount_paid: 1234,
      currency: "USD",
      product: "prod_local_ai",
    },
  };
  return { owner, object };
}

function signed(body: string) {
  return {
    "content-type": "application/json",
    "creem-signature": createHmac("sha256", secret).update(body).digest("hex"),
  };
}
function send(event: unknown) {
  const body = JSON.stringify(event);
  return fetch(endpoint, { method: "POST", headers: signed(body), body });
}

it("fulfills signed legacy Creem payments once through HTTP across concurrent delivery and different event IDs", async () => {
  const { owner, object } = await purchase();
  const responses = await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      send({ id: `evt_${index % 3}`, eventType: "checkout.completed", object }),
    ),
  );
  expect(responses.map((r) => r.status)).toEqual(Array(12).fill(200));
  const results = await Promise.all(responses.map((r) => r.json()));
  expect(results.filter((r) => r.processed)).toHaveLength(1);
  expect((await readWallet(owner.workspace.id)).balanceMicroUsd).toBe(
    "13340000",
  );
  expect(
    (await db.select().from(schema.aiLedgerTable)).filter(
      (row) => row.kind === "topup",
    ),
  ).toHaveLength(1);
});

it("accepts the standard webhook signature and normalized data envelope", async () => {
  const { owner, object } = await purchase();
  const body = JSON.stringify({
    id: "evt_standard",
    type: "checkout.completed",
    data: object,
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const id = "msg_standard";
  const key = Buffer.from("local-standard-webhook-fixture");
  vi.stubEnv("CREEM_WEBHOOK_SECRET", `whsec_${key.toString("base64")}`);
  const signature = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  const response = await fetch(endpoint, {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${signature}`,
    },
  });
  expect(response.status).toBe(200);
  expect((await readWallet(owner.workspace.id)).balanceMicroUsd).toBe(
    "13340000",
  );
});

it("rejects tampered signed payments before any durable event or credit mutation", async () => {
  const { owner, object } = await purchase();
  const signedBody = JSON.stringify({
    id: "evt_tamper",
    eventType: "checkout.completed",
    object,
  });
  const body = signedBody.replace('"amount":1234', '"amount":5000');
  vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await fetch(endpoint, {
    method: "POST",
    body,
    headers: signed(signedBody),
  });
  expect(response.status).toBe(400);
  expect(await db.select().from(schema.billingEventTable)).toHaveLength(0);
  expect((await readWallet(owner.workspace.id)).balanceMicroUsd).toBe(
    "1000000",
  );
});

it("rejects a validly signed mismatched payment but allows the corrected retry", async () => {
  const { owner, object } = await purchase();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const bad = await send({
    id: "evt_retry",
    eventType: "checkout.completed",
    object: { ...object, order: { ...object.order, currency: "EUR" } },
  });
  expect(bad.status).toBe(500);
  expect(await db.select().from(schema.billingEventTable)).toHaveLength(0);
  expect((await readWallet(owner.workspace.id)).balanceMicroUsd).toBe(
    "1000000",
  );
  expect(
    (await send({ id: "evt_retry", eventType: "checkout.completed", object }))
      .status,
  ).toBe(200);
  expect((await readWallet(owner.workspace.id)).balanceMicroUsd).toBe(
    "13340000",
  );
});

it("applies a signed refund arriving before payment and ignores replays", async () => {
  const { owner, object } = await purchase();
  const refund = {
    id: "evt_refund",
    eventType: "refund.created",
    object: {
      id: "refund_local",
      order: "order_local",
      status: "succeeded",
      refund_amount: 617,
      refund_currency: "USD",
    },
  };
  expect((await send(refund)).status).toBe(200);
  expect((await readWallet(owner.workspace.id)).balanceMicroUsd).toBe(
    "1000000",
  );
  expect(
    (await send({ id: "evt_paid", eventType: "checkout.completed", object }))
      .status,
  ).toBe(200);
  expect((await readWallet(owner.workspace.id)).balanceMicroUsd).toBe(
    "7170000",
  );
  expect((await send({ ...refund, id: "evt_refund_again" })).status).toBe(200);
  expect((await readWallet(owner.workspace.id)).balanceMicroUsd).toBe(
    "7170000",
  );
});

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { updateSubscriptionSeats } from "../../../apps/api/src/billing/creem-client";

// Indexed rather than read literally so Biome does not demand a turbo.json
// env declaration for a key only this test sets.
const API_KEY = "CREEM_API_KEY";
const savedApiKey = process.env[API_KEY];
const realFetch = globalThis.fetch;

type Call = { url: string; method: string; body: unknown };
let calls: Call[];

function subscription(items: Array<{ id: string; product_id?: string }>) {
  return {
    id: "sub_1",
    mode: "prod",
    object: "subscription",
    product: "prod_team",
    customer: "cust_1",
    items: items.map((item) => ({
      ...item,
      mode: "prod",
      object: "subscription_item",
      units: 1,
    })),
    collection_method: "charge_automatically",
    status: "active",
    created_at: "2026-09-25T09:40:01.887Z",
    updated_at: "2026-09-25T09:40:01.887Z",
  };
}

function respondWith(getBody: unknown) {
  globalThis.fetch = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : null;
      const url = request ? request.url : String(input);
      const method = request?.method ?? init?.method ?? "GET";
      const raw = request
        ? await request.text()
        : (init?.body as string | undefined);

      calls.push({ url, method, body: raw ? JSON.parse(raw) : undefined });

      return new Response(
        JSON.stringify(method === "POST" ? subscription([]) : getBody),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    },
  ) as typeof fetch;
}

beforeEach(() => {
  calls = [];
  process.env[API_KEY] = "creem_test_dummy";
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (savedApiKey === undefined) {
    delete process.env[API_KEY];
  } else {
    process.env[API_KEY] = savedApiKey;
  }
});

describe("updateSubscriptionSeats", () => {
  it("resizes the existing item by id instead of creating a second one", async () => {
    respondWith(
      subscription([
        { id: "sitem_other", product_id: "prod_personal" },
        { id: "sitem_team", product_id: "prod_team" },
      ]),
    );

    await updateSubscriptionSeats({
      subscriptionId: "sub_1",
      productId: "prod_team",
      units: 3,
    });

    const [read, write] = calls;
    expect(read.url).toContain("subscription_id=sub_1");
    expect(write.method).toBe("POST");
    expect(write.url).toContain("/v1/subscriptions/sub_1");
    expect(write.body).toEqual({
      items: [{ id: "sitem_team", units: 3 }],
      update_behavior: "proration-charge",
    });
  });

  it("falls back to the only item when the stored product id is stale", async () => {
    respondWith(
      subscription([{ id: "sitem_upgraded", product_id: "prod_new" }]),
    );

    await updateSubscriptionSeats({
      subscriptionId: "sub_1",
      productId: "prod_old",
      units: 4,
    });

    expect(calls[1].body).toEqual({
      items: [{ id: "sitem_upgraded", units: 4 }],
      update_behavior: "proration-charge",
    });
  });

  it("refuses to guess when several items exist and none match", async () => {
    respondWith(
      subscription([
        { id: "sitem_personal", product_id: "prod_personal" },
        { id: "sitem_addon", product_id: "prod_addon" },
      ]),
    );

    await expect(
      updateSubscriptionSeats({
        subscriptionId: "sub_1",
        productId: "prod_old",
        units: 4,
      }),
    ).rejects.toThrow("no item for product prod_old");

    expect(calls).toHaveLength(1);
  });

  it("throws instead of reporting success when the subscription has no items", async () => {
    respondWith(subscription([]));

    await expect(
      updateSubscriptionSeats({
        subscriptionId: "sub_1",
        productId: "prod_team",
        units: 2,
      }),
    ).rejects.toThrow("no item for product prod_team");

    expect(calls).toHaveLength(1);
  });
});

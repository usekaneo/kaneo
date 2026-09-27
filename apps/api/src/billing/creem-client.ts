import { Creem } from "creem";
import { HTTPException } from "hono/http-exception";
import { creemApiKey } from "./config";

function creemClient() {
  return new Creem({
    apiKey: creemApiKey(),
    server: process.env.CREEM_TEST_MODE === "true" ? "test" : "prod",
  });
}

export async function createCheckoutSession(input: {
  productId: string;
  units: number;
  successUrl: string;
  requestId: string;
  customerEmail: string;
  metadata: Record<string, string>;
}) {
  try {
    const checkout = await creemClient().checkouts.create({
      productId: input.productId,
      units: input.units,
      successUrl: input.successUrl,
      requestId: input.requestId,
      customer: { email: input.customerEmail },
      metadata: input.metadata,
    });

    if (!checkout.checkoutUrl) {
      throw new Error("Checkout session has no URL");
    }
    return { checkoutUrl: checkout.checkoutUrl };
  } catch (error) {
    console.error("Creem checkout creation failed:", error);
    throw new HTTPException(502, {
      message: "Billing provider request failed",
    });
  }
}

export async function updateSubscriptionSeats(input: {
  subscriptionId: string;
  productId: string;
  units: number;
}) {
  const client = creemClient();

  const subscription = await client.subscriptions.get(input.subscriptionId);
  const items = subscription.items ?? [];
  // A stale stored product id still resolves on a single-item subscription,
  // which is the shape Kaneo sells. Guessing among several items would bill
  // the wrong product, so that case has to be repaired by hand.
  const item =
    items.find((entry) => entry.productId === input.productId) ??
    (items.length === 1 ? items[0] : undefined);

  if (!item) {
    throw new Error(
      `Creem subscription ${input.subscriptionId} has no item for product ${input.productId}`,
    );
  }

  // Creem creates an additional item when the item id is omitted, and rejects
  // the duplicate product with a 403, so the existing item id must be sent.
  await client.subscriptions.update(input.subscriptionId, {
    items: [{ id: item.id, units: input.units }],
    updateBehavior: "proration-charge",
  });
}

export async function createCustomerPortalLink(customerId: string) {
  try {
    const links = await creemClient().customers.generateBillingLinks({
      customerId,
    });
    return { portalUrl: links.customerPortalLink };
  } catch (error) {
    console.error("Creem portal link creation failed:", error);
    throw new HTTPException(502, {
      message: "Billing provider request failed",
    });
  }
}

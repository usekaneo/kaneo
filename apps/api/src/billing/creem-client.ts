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
  try {
    await creemClient().subscriptions.update(input.subscriptionId, {
      items: [{ productId: input.productId, units: input.units }],
      updateBehavior: "proration-charge",
    });
    return { ok: true as const };
  } catch (error) {
    console.error("Creem seat update failed:", error);
    return { ok: false as const };
  }
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

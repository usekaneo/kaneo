import { nullableResponseTimestamp, z } from "../openapi";

export const billingEntitlementSchema = z
  .object({
    active: z.boolean().openapi({
      description: "Whether the workspace currently has paid-tier access.",
    }),
    reason: z
      .enum([
        "billing_disabled",
        "founding_free",
        "subscription",
        "trial",
        "expired",
      ])
      .openapi({
        description:
          "Why access is granted or denied. `billing_disabled` means the instance is not running billing at all, so everything is unlocked.",
      }),
  })
  .openapi("BillingEntitlement");

export const workspaceBillingSchema = z
  .object({
    billingEnabled: z.boolean().openapi({
      description: "False when the instance has no billing configured.",
    }),
    entitlement: billingEntitlementSchema,
    foundingFree: z.boolean(),
    trialEndsAt: nullableResponseTimestamp,
    plan: z
      .string()
      .nullable()
      .openapi({ description: "`personal` or `team`." }),
    billingInterval: z
      .string()
      .nullable()
      .openapi({ description: "`monthly` or `annual`." }),
    status: z
      .string()
      .nullable()
      .openapi({ description: "The provider's subscription status." }),
    seats: z.number(),
    currentPeriodEnd: nullableResponseTimestamp,
    canceledAt: nullableResponseTimestamp,
    hasCustomer: z.boolean().openapi({
      description:
        "Whether a billing customer exists yet. The portal link requires one.",
    }),
  })
  .openapi("WorkspaceBilling");

export const checkoutSchema = z
  .object({
    checkoutUrl: z.string().openapi({
      description: "Redirect the browser here to complete payment.",
    }),
  })
  .openapi("BillingCheckout");

export const portalSchema = z
  .object({
    portalUrl: z.string().openapi({
      description: "A short-lived link to the provider's customer portal.",
    }),
  })
  .openapi("BillingPortal");

export const webhookResultSchema = z
  .object({
    processed: z.boolean(),
    duplicate: z.boolean().openapi({
      description:
        "True when this event id was already applied, so the delivery was a safe no-op.",
    }),
  })
  .openapi("BillingWebhookResult");

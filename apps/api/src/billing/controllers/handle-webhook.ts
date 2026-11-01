import { eq } from "drizzle-orm";
import db from "../../database";
import {
  billingEventTable,
  workspaceBillingTable,
} from "../../database/schema";
import { completeTopup } from "../ai/complete-topup";
import { recordReversal } from "../ai/payment-reversals";
import type { TopupCheckout } from "../ai/payment-types";
import { planForProductId } from "../config";

type WebhookObject = Omit<TopupCheckout, "order" | "product"> & {
  order?: TopupCheckout["order"] | string;
  amount?: number;
  refund_amount?: number;
  refundAmount?: number;
  refund_currency?: string;
  refundCurrency?: string;
  currency?: string;
  checkout?: string | { id?: string };
  transaction?: { id?: string };
  id?: string;
  status?: string;
  metadata?: Record<string, string>;
  product?: { id?: string } | string;
  customer?: { id?: string };
  subscription?: {
    id?: string;
    status?: string;
    metadata?: Record<string, string>;
    product?: { id?: string };
    customer?: { id?: string };
  };
  order_id?: string;
  current_period_end_date?: string;
  currentPeriodEndDate?: string;
  canceled_at?: string | null;
  canceledAt?: string | null;
  items?: Array<{ units?: number }>;
};

export type BillingWebhookEvent = {
  id?: string;
  type: string;
  data: WebhookObject;
};

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const SUBSCRIPTION_EVENT_STATUS: Record<string, string> = {
  "subscription.active": "active",
  "subscription.trialing": "trialing",
  "subscription.paid": "active",
  "subscription.scheduled_cancel": "scheduled_cancel",
  "subscription.canceled": "canceled",
  "subscription.past_due": "past_due",
  "subscription.expired": "expired",
  "subscription.paused": "paused",
};

export function buildSubscriptionUpdates(event: BillingWebhookEvent) {
  const object = event.data;
  const productId =
    typeof object.product === "string" ? object.product : object.product?.id;
  const mapped = productId ? planForProductId(productId) : null;
  const units = object.items?.[0]?.units;

  const updates: Partial<typeof workspaceBillingTable.$inferInsert> = {
    status: object.status ?? SUBSCRIPTION_EVENT_STATUS[event.type] ?? undefined,
  };

  const periodEnd =
    object.current_period_end_date !== undefined
      ? object.current_period_end_date
      : object.currentPeriodEndDate;
  if (periodEnd !== undefined) {
    updates.currentPeriodEnd = parseDate(periodEnd);
  }

  const canceledAt =
    object.canceled_at !== undefined ? object.canceled_at : object.canceledAt;
  if (canceledAt !== undefined) {
    updates.canceledAt = parseDate(canceledAt);
  }

  if (productId) {
    updates.creemProductId = productId;
    updates.plan = mapped?.plan ?? null;
    updates.billingInterval = mapped?.interval ?? null;
  }
  if (typeof units === "number" && units > 0) {
    updates.seats = units;
  }
  if (object.customer?.id) {
    updates.creemCustomerId = object.customer.id;
  }

  return updates;
}

async function applyEvent(event: BillingWebhookEvent, tx: DbOrTx) {
  const object = event.data;

  if (event.type === "refund.created" || event.type === "dispute.created") {
    if (event.type === "refund.created" && object.status !== "succeeded")
      return { processed: false, duplicate: false };
    if (!object.id) throw new Error("Payment reversal has no reference");
    const amount =
      event.type === "dispute.created"
        ? null
        : (object.refundAmount ?? object.refund_amount);
    if (
      amount === undefined ||
      (amount !== null && (!Number.isSafeInteger(amount) || amount <= 0))
    )
      throw new Error("Invalid refund amount");
    return recordReversal(
      {
        id: object.id,
        orderId:
          typeof object.order === "string"
            ? object.order
            : (object.order?.id ?? object.order_id),
        checkoutId:
          typeof object.checkout === "string"
            ? object.checkout
            : object.checkout?.id,
        transactionId: object.transaction?.id,
        cents: amount,
        currency:
          object.refundCurrency ??
          object.refund_currency ??
          object.currency ??
          "",
      },
      tx,
    );
  }
  if (
    event.type === "checkout.completed" &&
    (object.metadata?.purchaseType === "ai_topup" || object.metadata?.aiTopupId)
  ) {
    if (typeof object.order === "string")
      throw new Error("Missing top-up payment details");
    return completeTopup({ ...object, order: object.order }, tx);
  }

  if (event.type === "checkout.completed") {
    const workspaceId =
      object.metadata?.workspaceId ??
      object.subscription?.metadata?.workspaceId;
    if (!workspaceId) {
      console.error("billing: checkout.completed without workspaceId");
      return { processed: false, duplicate: false };
    }

    const productId =
      (typeof object.product === "string"
        ? object.product
        : object.product?.id) ?? object.subscription?.product?.id;
    const mapped = productId ? planForProductId(productId) : null;
    if (!mapped) return { processed: false, duplicate: false };

    await tx
      .update(workspaceBillingTable)
      .set({
        creemCustomerId:
          object.customer?.id ?? object.subscription?.customer?.id ?? null,
        creemSubscriptionId: object.subscription?.id ?? null,
        creemProductId: productId ?? null,
        plan: mapped?.plan ?? null,
        billingInterval: mapped?.interval ?? null,
        status: object.subscription?.status ?? "active",
      })
      .where(eq(workspaceBillingTable.workspaceId, workspaceId));
    return { processed: true, duplicate: false };
  }

  if (event.type.startsWith("subscription.")) {
    const subscriptionId = object.id;
    if (!subscriptionId) {
      return { processed: false, duplicate: false };
    }

    const updates = buildSubscriptionUpdates(event);

    const updated = await tx
      .update(workspaceBillingTable)
      .set(updates)
      .where(eq(workspaceBillingTable.creemSubscriptionId, subscriptionId))
      .returning({ id: workspaceBillingTable.id });

    if (updated.length === 0 && object.metadata?.workspaceId) {
      await tx
        .update(workspaceBillingTable)
        .set({ ...updates, creemSubscriptionId: subscriptionId })
        .where(
          eq(workspaceBillingTable.workspaceId, object.metadata.workspaceId),
        );
    }
    return { processed: true, duplicate: false };
  }

  return { processed: true, duplicate: false };
}

async function handleWebhook(event: BillingWebhookEvent) {
  const eventId = event.id;
  if (!eventId) {
    return db.transaction((tx) => applyEvent(event, tx));
  }

  // A claim that outlives a failed apply makes the retry look like a duplicate.
  return db.transaction(async (tx) => {
    const [claimed] = await tx
      .insert(billingEventTable)
      .values({ id: eventId, eventType: event.type })
      .onConflictDoNothing({ target: billingEventTable.id })
      .returning();

    if (!claimed) {
      return { processed: false, duplicate: true };
    }

    return applyEvent(event, tx);
  });
}

export default handleWebhook;

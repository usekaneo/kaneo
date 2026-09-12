import { eq } from "drizzle-orm";
import db from "../../database";
import {
  billingEventTable,
  workspaceBillingTable,
} from "../../database/schema";
import { planForProductId } from "../config";

type WebhookObject = {
  id?: string;
  status?: string;
  metadata?: Record<string, string>;
  product?: { id?: string };
  customer?: { id?: string };
  subscription?: {
    id?: string;
    status?: string;
    metadata?: Record<string, string>;
    product?: { id?: string };
    customer?: { id?: string };
  };
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
  const productId = object.product?.id;
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

  if (event.type === "checkout.completed") {
    const workspaceId =
      object.metadata?.workspaceId ??
      object.subscription?.metadata?.workspaceId;
    if (!workspaceId) {
      console.error("billing: checkout.completed without workspaceId");
      return { processed: false, duplicate: false };
    }

    const productId = object.product?.id ?? object.subscription?.product?.id;
    const mapped = productId ? planForProductId(productId) : null;

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
    return applyEvent(event, db);
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

import { and, eq, or } from "drizzle-orm";
import { schema } from "../../database";
import type { CreditDatabase } from "./wallet";
import type { TopupCheckout } from "./payment-types";
import { applyReversal } from "./payment-reversals";

export async function completeTopup(object: TopupCheckout, tx: CreditDatabase) {
  const id = object.metadata?.aiTopupId;
  if (!id) throw new Error("Missing AI top-up reference");
  const [purchase] = await tx
    .select()
    .from(schema.aiTopupTable)
    .where(eq(schema.aiTopupTable.id, id));
  if (!purchase) throw new Error("Unknown AI top-up");
  const [wallet] = await tx
    .select()
    .from(schema.aiWalletTable)
    .where(eq(schema.aiWalletTable.workspaceId, purchase.workspaceId))
    .for("update");
  const order = object.order;
  const paidCents = order?.amountPaid ?? order?.amount_paid ?? order?.amount;
  const checkoutProductId =
    typeof object.product === "string" ? object.product : object.product?.id;
  const orderProduct =
    typeof order?.product === "string" ? order.product : order?.product?.id;
  if (
    !wallet ||
    !object.id ||
    !order?.id ||
    object.status !== "completed" ||
    order.status !== "paid" ||
    !Number.isSafeInteger(paidCents) ||
    paidCents! < purchase.cents ||
    (order.subTotal ?? order.sub_total ?? order.amount) !== purchase.cents ||
    (order.discountAmount ?? order.discount_amount ?? 0) !== 0 ||
    order.currency?.toUpperCase() !== "USD" ||
    checkoutProductId !== purchase.productId ||
    (orderProduct && orderProduct !== purchase.productId) ||
    object.metadata?.workspaceId !== purchase.workspaceId ||
    (object.request_id ?? object.requestId) !== purchase.id ||
    (purchase.checkoutId && purchase.checkoutId !== object.id)
  )
    throw new Error("AI top-up payment does not match the checkout");
  const [claimed] = await tx
    .update(schema.aiTopupTable)
    .set({
      status: "paid",
      checkoutId: object.id,
      orderId: order.id,
      transactionId: order.transaction,
      paidCents,
    })
    .where(
      and(
        eq(schema.aiTopupTable.id, id),
        eq(schema.aiTopupTable.status, "pending"),
      ),
    )
    .returning();
  if (!claimed) return { processed: false, duplicate: true };
  const amount = BigInt(purchase.cents) * 10000n;
  await tx.insert(schema.aiLedgerTable).values({
    workspaceId: purchase.workspaceId,
    source: `order:${order.id}`,
    kind: "topup",
    amount,
  });
  await tx
    .update(schema.aiWalletTable)
    .set({ balance: wallet.balance + amount })
    .where(eq(schema.aiWalletTable.workspaceId, purchase.workspaceId));
  const pending = await tx
    .select()
    .from(schema.aiPaymentReversalTable)
    .where(
      and(
        eq(schema.aiPaymentReversalTable.applied, false),
        or(
          eq(schema.aiPaymentReversalTable.orderId, order.id),
          eq(schema.aiPaymentReversalTable.checkoutId, object.id),
          ...(order.transaction
            ? [
                eq(
                  schema.aiPaymentReversalTable.transactionId,
                  order.transaction,
                ),
              ]
            : []),
        ),
      ),
    );
  for (const reversal of pending) await applyReversal(reversal, tx);
  return { processed: true, duplicate: false };
}

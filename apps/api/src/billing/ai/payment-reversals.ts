import { and, eq, gt, or } from "drizzle-orm";
import db, { schema } from "../../database";
import type { CreditDatabase } from "./wallet";

async function reverseTopup(
  orderId: string,
  sourceId: string,
  refundCents: number | null,
  tx: CreditDatabase,
) {
  const [purchase] = await tx
    .select()
    .from(schema.aiTopupTable)
    .where(eq(schema.aiTopupTable.orderId, orderId));
  if (!purchase) return null;
  const [wallet] = await tx
    .select()
    .from(schema.aiWalletTable)
    .where(eq(schema.aiWalletTable.workspaceId, purchase.workspaceId))
    .for("update");
  const [current] = await tx
    .select()
    .from(schema.aiTopupTable)
    .where(eq(schema.aiTopupTable.id, purchase.id));
  if (!current || current.status === "pending")
    throw new Error("Top-up payment pending");
  const paid = BigInt(current.paidCents ?? current.cents);
  const totalRefunded =
    refundCents === null
      ? paid
      : BigInt(current.refundedPaidCents) + BigInt(refundCents);
  const cappedRefund = totalRefunded > paid ? paid : totalRefunded;
  // Round the cumulative proportion once, not each refund. Integer arithmetic
  // also remains exact for large custom top-ups whose products exceed 2^53.
  const target = Number(
    (cappedRefund * BigInt(current.cents) + paid - 1n) / paid,
  );
  const cents = target - current.refundedCents;
  if (!Number.isSafeInteger(cents) || cents < 0)
    throw new Error("Invalid AI credit refund");
  const amount = BigInt(cents) * 10000n;
  const [entry] = await tx
    .insert(schema.aiLedgerTable)
    .values({
      workspaceId: purchase.workspaceId,
      source: `reversal:${sourceId}`,
      kind: "reversal",
      amount: -amount,
    })
    .onConflictDoNothing()
    .returning();
  if (!entry) return { processed: false, duplicate: true };
  await tx
    .update(schema.aiTopupTable)
    .set({
      refundedCents: target,
      refundedPaidCents: Number(cappedRefund),
      status: target >= current.cents ? "reversed" : "paid",
    })
    .where(eq(schema.aiTopupTable.id, current.id));
  await tx
    .update(schema.aiWalletTable)
    .set({ balance: wallet!.balance - amount })
    .where(eq(schema.aiWalletTable.workspaceId, purchase.workspaceId));
  return { processed: true, duplicate: false };
}

export type PaymentReversal = typeof schema.aiPaymentReversalTable.$inferInsert;
export async function applyReversal(
  reversal: PaymentReversal,
  tx: CreditDatabase,
) {
  const matches = [
    reversal.orderId
      ? eq(schema.aiTopupTable.orderId, reversal.orderId)
      : undefined,
    reversal.checkoutId
      ? eq(schema.aiTopupTable.checkoutId, reversal.checkoutId)
      : undefined,
    reversal.transactionId
      ? eq(schema.aiTopupTable.transactionId, reversal.transactionId)
      : undefined,
  ].filter((item) => item !== undefined);
  if (!matches.length)
    throw new Error("Payment reversal has no payment reference");
  const [purchase] = await tx
    .select()
    .from(schema.aiTopupTable)
    .where(or(...matches));
  if (!purchase?.orderId || purchase.status === "pending")
    return { processed: true, duplicate: false };
  if (reversal.currency.toUpperCase() !== "USD")
    throw new Error("Invalid AI refund currency");
  const result = await reverseTopup(
    purchase.orderId,
    reversal.id,
    reversal.cents ?? null,
    tx,
  );
  await tx
    .update(schema.aiPaymentReversalTable)
    .set({ applied: true })
    .where(eq(schema.aiPaymentReversalTable.id, reversal.id));
  return result!;
}

export async function recordReversal(
  reversal: PaymentReversal,
  tx: CreditDatabase,
) {
  await tx
    .insert(schema.aiPaymentReversalTable)
    .values(reversal)
    .onConflictDoNothing();
  const [stored] = await tx
    .select()
    .from(schema.aiPaymentReversalTable)
    .where(eq(schema.aiPaymentReversalTable.id, reversal.id));
  return applyReversal(stored!, tx);
}

let cursor = "";
export async function reconcilePaymentReversals() {
  // Cursor rotation prevents unrelated subscription reversals from starving AI
  // payments when webhook delivery races checkout fulfillment.
  const pending = await db
    .select()
    .from(schema.aiPaymentReversalTable)
    .where(
      and(
        eq(schema.aiPaymentReversalTable.applied, false),
        gt(schema.aiPaymentReversalTable.id, cursor),
      ),
    )
    .orderBy(schema.aiPaymentReversalTable.id)
    .limit(20);
  if (!pending.length) {
    cursor = "";
    return;
  }
  for (const reversal of pending) {
    try {
      await db.transaction((tx) => applyReversal(reversal, tx));
    } catch {
      // Do not log payment payloads or prevent other workspaces from settling.
      console.error("AI payment reversal requires operator review", {
        reversalId: reversal.id,
      });
    } finally {
      cursor = reversal.id;
    }
  }
}

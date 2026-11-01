import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { createCheckoutSession } from "../creem-client";
import { isBillingEnabled } from "../config";
import { MAX_TOPUP_CENTS, MIN_TOPUP_CENTS, topupProductId } from "./config";
import { initializeWallet } from "./wallet";

export async function createTopup(
  workspaceId: string,
  userId: string,
  email: string,
  cents: number,
  requestId: string,
) {
  if (!isBillingEnabled())
    throw new HTTPException(503, { message: "Billing is not configured" });
  if (
    !Number.isSafeInteger(cents) ||
    cents < MIN_TOPUP_CENTS ||
    cents > MAX_TOPUP_CENTS
  )
    throw new HTTPException(400, {
      message:
        "AI top-ups must be at least $5 and within the supported payment limit",
    });
  const productId = topupProductId();
  if (!productId)
    throw new HTTPException(400, { message: "AI top-up is unavailable" });
  const topup = await db.transaction(async (tx) => {
    await initializeWallet(workspaceId, tx);
    await tx
      .insert(schema.aiTopupTable)
      .values({
        workspaceId,
        userId,
        cents,
        productId,
        requestId,
      })
      .onConflictDoNothing();
    const [row] = await tx
      .select()
      .from(schema.aiTopupTable)
      .where(
        and(
          eq(schema.aiTopupTable.workspaceId, workspaceId),
          eq(schema.aiTopupTable.requestId, requestId),
        ),
      );
    if (
      !row ||
      row.cents !== cents ||
      row.productId !== productId ||
      row.userId !== userId
    )
      throw new HTTPException(409, { message: "Top-up request ID conflicts" });
    if (row.status !== "pending")
      throw new HTTPException(409, { message: "Top-up already completed" });
    return row;
  });
  return db.transaction(async (tx) => {
    // Serialize checkout creation for retries. request_id is also a provider
    // correlation key; correctness does not depend on provider deduplication.
    const [current] = await tx
      .select()
      .from(schema.aiTopupTable)
      .where(eq(schema.aiTopupTable.id, topup.id))
      .for("update");
    if (!current || current.status !== "pending")
      throw new HTTPException(409, { message: "Top-up already completed" });
    if (current.checkoutUrl) return { checkoutUrl: current.checkoutUrl };
    const result = await createCheckoutSession({
      productId: current.productId,
      customPrice: current.cents,
      units: 1,
      successUrl: `${process.env.KANEO_CLIENT_URL ?? ""}/dashboard/settings/workspace/billing?checkout=ai-success`,
      requestId: current.id,
      customerEmail: email,
      metadata: {
        workspaceId,
        aiTopupId: current.id,
        purchaseType: "ai_topup",
      },
    });
    await tx
      .update(schema.aiTopupTable)
      .set({ checkoutId: result.checkoutId, checkoutUrl: result.checkoutUrl })
      .where(eq(schema.aiTopupTable.id, current.id));
    return { checkoutUrl: result.checkoutUrl };
  });
}

import { and, eq, inArray, isNotNull, lt, lte } from "drizzle-orm";
import { z } from "zod";
import db, { schema } from "../../database";
import { getProviderSettings } from "../../agent/providers/settings";
import { aiBillingEnabled } from "./config";
import { pricedMicroUsd } from "./money";
import { reconcilePaymentReversals } from "./payment-reversals";
import { settleCredit } from "./wallet";

const generationSchema = z.object({
  data: z.object({
    id: z.string(),
    total_cost: z.number().nonnegative().finite(),
    generation_time: z.number().nullable().optional(),
  }),
});
let lastPoll = 0;
export async function reconcileAiCredit(now = new Date()) {
  if (!aiBillingEnabled() || now.getTime() - lastPoll < 60000) return;
  lastPoll = now.getTime();
  await reconcilePaymentReversals().catch(() =>
    console.error("AI payment reversal reconciliation failed"),
  );
  const settings = getProviderSettings("openrouter");
  if (
    !settings?.apiKey ||
    (settings.baseURL &&
      settings.baseURL.replace(/\/$/, "") !== "https://openrouter.ai/api/v1")
  )
    return;
  const held = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(schema.aiReservationTable)
      .where(
        and(
          eq(schema.aiReservationTable.status, "held"),
          isNotNull(schema.aiReservationTable.generationId),
          lt(
            schema.aiReservationTable.createdAt,
            new Date(now.getTime() - 600000),
          ),
          lte(schema.aiReservationTable.nextReconcileAt, now),
        ),
      )
      .orderBy(
        schema.aiReservationTable.nextReconcileAt,
        schema.aiReservationTable.createdAt,
        schema.aiReservationTable.id,
      )
      .limit(8)
      .for("update", { skipLocked: true });
    if (rows.length)
      await tx
        .update(schema.aiReservationTable)
        .set({ nextReconcileAt: new Date(now.getTime() + 60000) })
        .where(
          inArray(
            schema.aiReservationTable.id,
            rows.map((item) => item.id),
          ),
        );
    return rows;
  });
  for (const item of held) {
    try {
      const response = await fetch(
        `https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(item.generationId!)}`,
        {
          headers: { Authorization: `Bearer ${settings.apiKey}` },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!response.ok) continue;
      const { data } = generationSchema.parse(await response.json());
      if (data.id !== item.generationId || data.generation_time == null)
        continue;
      await settleCredit(
        item.id,
        pricedMicroUsd(data.total_cost, item.multiplierBps),
      );
    } catch {
      // Keep unknown charges reserved; never expose upstream responses/secrets.
    }
  }
}

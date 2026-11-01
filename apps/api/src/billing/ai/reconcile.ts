import { and, eq, gt, isNotNull, lt } from "drizzle-orm";
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
let cursor = "";
export async function reconcileAiCredit() {
  if (!aiBillingEnabled() || Date.now() - lastPoll < 60000) return;
  lastPoll = Date.now();
  await reconcilePaymentReversals();
  const settings = getProviderSettings("openrouter");
  if (
    !settings?.apiKey ||
    (settings.baseURL &&
      settings.baseURL.replace(/\/$/, "") !== "https://openrouter.ai/api/v1")
  )
    return;
  const held = await db
    .select()
    .from(schema.aiReservationTable)
    .where(
      and(
        eq(schema.aiReservationTable.status, "held"),
        gt(schema.aiReservationTable.id, cursor),
        isNotNull(schema.aiReservationTable.generationId),
        lt(schema.aiReservationTable.createdAt, new Date(Date.now() - 600000)),
      ),
    )
    .orderBy(schema.aiReservationTable.id)
    .limit(8);
  if (!held.length) cursor = "";
  for (const item of held) {
    cursor = item.id;
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

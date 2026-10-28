import { randomUUID } from "node:crypto";
import { and, eq, isNull, lt, or, notExists } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import db, { schema } from "../database";
import { eventContext } from "../events";
import { publishAgentEffect } from "./publish-effect";

export async function deliverAgentEffects() {
  for (let index = 0; index < 20; index++) {
    const owner = randomUUID();
    const effect = await db.transaction(async (tx) => {
      const earlier = alias(schema.agentEffectTable, "earlier_agent_effect");
      const [effect] = await tx
        .select()
        .from(schema.agentEffectTable)
        .where(
          and(
            isNull(schema.agentEffectTable.deliveredAt),
            or(
              isNull(schema.agentEffectTable.leaseExpiresAt),
              lt(schema.agentEffectTable.leaseExpiresAt, new Date()),
            ),
            notExists(
              tx
                .select({ id: earlier.id })
                .from(earlier)
                .where(
                  and(
                    eq(earlier.proposalId, schema.agentEffectTable.proposalId),
                    lt(earlier.sequence, schema.agentEffectTable.sequence),
                    isNull(earlier.deliveredAt),
                  ),
                ),
            ),
          ),
        )
        .orderBy(schema.agentEffectTable.sequence)
        .limit(1)
        .for("update", { skipLocked: true });
      if (!effect) return null;
      await tx
        .update(schema.agentEffectTable)
        .set({
          leaseOwner: owner,
          leaseExpiresAt: new Date(Date.now() + 60000),
        })
        .where(eq(schema.agentEffectTable.id, effect.id));
      return effect;
    });
    if (!effect) return;
    try {
      await eventContext.exit(() =>
        publishAgentEffect(effect.payload, effect.userId),
      );
      await db
        .update(schema.agentEffectTable)
        .set({
          deliveredAt: new Date(),
          leaseOwner: null,
          leaseExpiresAt: null,
        })
        .where(
          and(
            eq(schema.agentEffectTable.id, effect.id),
            eq(schema.agentEffectTable.leaseOwner, owner),
          ),
        );
    } catch {
      // Leave the lease to expire before retrying. Never replay the mutation.
      return;
    }
  }
}

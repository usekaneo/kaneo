import { tangledIntegrationStateTable } from "../../database/schema";
import type { TangledTransaction } from "./connection";
import type { TangledOutcome } from "./outcome-types";

export async function recordTangledOutcome(
  transaction: TangledTransaction,
  integrationId: string,
  outcome: TangledOutcome,
): Promise<void> {
  // One latest outcome per connection bounds storage without keeping webhook payloads.
  const values = { ...outcome, checkedAt: new Date() };
  await transaction
    .insert(tangledIntegrationStateTable)
    .values({ integrationId, ...values })
    .onConflictDoUpdate({
      target: tangledIntegrationStateTable.integrationId,
      set: values,
    });
}

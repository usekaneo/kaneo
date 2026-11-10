import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";

import { text, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
export const integrationDeliveries = quillsSchema
  .table(
    "integration_deliveries",
    {
      workspaceId: workspaceColumn(),
      provider: text("provider").notNull(),
      deliveryId: text("delivery_id").notNull(),
      receivedAt: timestamp("received_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (table) => [
      primaryKey({
        name: "integration_deliveries_pkey",
        columns: [table.workspaceId, table.provider, table.deliveryId],
      }),
      index("integration_deliveries_received_idx").on(table.receivedAt),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

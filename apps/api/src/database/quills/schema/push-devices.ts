import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
import {
  text,
  timestamp,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core";
import { typeIdWithDefault, typeIdColumn } from "@kaneo/ids/drizzle";
import { principal } from "./auth";

/**
 * Push notification devices for the mobile agent app. One row per APNs/FCM
 * registration token, owned by the agent's principal. Scoped to the workspace by
 * the database connection (database-per-workspace); no workspace column.
 *
 * Generic by design: registering a device says nothing about "cloud" or any
 * specific app — a self-hoster who never ships an app simply never writes here.
 * An external push consumer reads this table to deliver notifications.
 */
export const pushDevices = quillsSchema
  .table(
    "push_devices",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("push_device")("id").notNull(),
      // The agent this device belongs to. `cascade` so deleting a principal
      // cleans up their device rows.
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      // The APNs/FCM registration token. Unique so a re-register upserts in place
      // (a token can only ever belong to one principal at a time).
      token: text("token").notNull(),
      platform: text("platform", { enum: ["ios", "android"] }).notNull(),
      // Bumped on every re-register so stale tokens can be pruned later.
      lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      // Named to match the constraint the SQL migration created.
      foreignKey({
        name: "push_devices_principal_id_fkey",
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      uniqueIndex("push_devices_token_idx").on(table.workspaceId, table.token),
      index("push_devices_principal_idx").on(table.principalId),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

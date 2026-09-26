import type { BetterAuthOptions } from "better-auth";
import type { DBAdapter } from "better-auth/adapters";
import {
  type DrizzleAdapterConfig,
  drizzleAdapter,
} from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { count, sql } from "drizzle-orm";
import db, { schema } from ".";

function isAdmin(role: unknown) {
  return typeof role === "string" && role.split(",").includes("admin");
}

export function authDatabaseAdapter(config: DrizzleAdapterConfig) {
  return (options: BetterAuthOptions): DBAdapter => {
    const adapter = drizzleAdapter(db, config)(options);
    return {
      ...adapter,
      async update<T>(data: Parameters<DBAdapter["update"]>[0]) {
        if (
          data.model !== "user" ||
          !Object.hasOwn(data.update, "role") ||
          isAdmin(data.update.role)
        ) {
          return adapter.update<T>(data);
        }

        return db.transaction(async (tx) => {
          // Serialize role removals across API instances, keeping the count
          // and write in the same transaction so cross-demotions cannot race.
          await tx.execute(sql`SELECT pg_advisory_xact_lock(2026, 1732)`);
          const transactionAdapter = drizzleAdapter(tx, config)(options);
          const user = await transactionAdapter.findOne<{ role?: string }>({
            model: data.model,
            where: data.where,
          });

          if (isAdmin(user?.role)) {
            const [admins] = await tx
              .select({ value: count() })
              .from(schema.userTable)
              .where(
                sql`'admin' = ANY(string_to_array(${schema.userTable.role}, ','))`,
              );
            if ((admins?.value ?? 0) <= 1) {
              throw new APIError("BAD_REQUEST", {
                code: "CANNOT_REMOVE_LAST_ADMIN",
                message: "The instance must have at least one administrator.",
              });
            }
          }

          return transactionAdapter.update<T>(data);
        });
      },
    };
  };
}

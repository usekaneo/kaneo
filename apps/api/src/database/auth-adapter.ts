import { AsyncLocalStorage } from "node:async_hooks";
import type { BetterAuthOptions } from "better-auth";
import type { DBAdapter } from "better-auth/adapters";
import {
  type DrizzleAdapterConfig,
  drizzleAdapter,
} from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { asc, count, eq, inArray, sql } from "drizzle-orm";
import {
  hasInstanceAdminRole,
  instanceAdminRoleSql,
} from "../utils/instance-admin-role";
import db, { schema } from ".";

type OtherSessionRevocationAdapter = DBAdapter & {
  revokeOtherUserSessions(
    userId: string,
    currentToken: string,
    remove: (tokens: string[]) => Promise<void>,
  ): Promise<void>;
};

function supportsOtherSessionRevocation(
  adapter: DBAdapter,
): adapter is OtherSessionRevocationAdapter {
  return (
    "revokeOtherUserSessions" in adapter &&
    typeof adapter.revokeOtherUserSessions === "function"
  );
}

export async function revokeOtherUserSessions(
  adapter: DBAdapter,
  userId: string,
  currentToken: string,
  remove: (tokens: string[]) => Promise<void>,
) {
  if (!supportsOtherSessionRevocation(adapter)) {
    throw new Error("Session revocation requires the locking auth adapter");
  }
  await adapter.revokeOtherUserSessions(userId, currentToken, remove);
}

export function authDatabaseAdapter(config: DrizzleAdapterConfig) {
  return (options: BetterAuthOptions): OtherSessionRevocationAdapter => {
    const adapter = drizzleAdapter(db, config)(options);
    const otherSessionRevocation = new AsyncLocalStorage<{
      adapter: DBAdapter;
      where: Parameters<DBAdapter["deleteMany"]>[0]["where"];
    }>();
    async function deleteSessions<T>(
      data: Parameters<DBAdapter["delete"]>[0],
      remove: (transactionAdapter: DBAdapter) => Promise<T>,
    ): Promise<T> {
      return db.transaction(async (tx) => {
        const transactionAdapter = drizzleAdapter(tx, config)(options);
        const sessions = await transactionAdapter.findMany<{ userId: string }>({
          model: "session",
          where: data.where,
          select: ["userId"],
          // The adapter otherwise defaults to 100 rows. Every affected user
          // must participate in the lock, including bulk session revocations.
          limit: Number.MAX_SAFE_INTEGER,
        });
        const userIds = [...new Set(sessions.map((session) => session.userId))];
        if (userIds.length) {
          // MCP redemption takes the same user-before-session lock order.
          // Run DELETE after this lock: a DELETE started before waiting could
          // miss a newly redeemed session in its statement snapshot.
          await tx
            .select({ id: schema.userTable.id })
            .from(schema.userTable)
            .where(inArray(schema.userTable.id, userIds))
            .orderBy(asc(schema.userTable.id))
            .for("update");
        }
        return remove(transactionAdapter);
      });
    }
    return {
      ...adapter,
      async revokeOtherUserSessions(userId, currentToken, remove) {
        await db.transaction(async (tx) => {
          // Lock even when no other session existed before waiting. MCP code
          // redemption takes this user lock before validating its approver.
          await tx
            .select({ id: schema.userTable.id })
            .from(schema.userTable)
            .where(eq(schema.userTable.id, userId))
            .for("update");
          const transactionAdapter = drizzleAdapter(tx, config)(options);
          const where: Parameters<DBAdapter["deleteMany"]>[0]["where"] = [
            { field: "userId", value: userId },
            { field: "token", value: currentToken, operator: "ne" },
          ];
          const sessions = await transactionAdapter.findMany<{ token: string }>(
            {
              model: "session",
              where,
              select: ["token"],
              limit: Number.MAX_SAFE_INTEGER,
            },
          );
          const scope = { adapter: transactionAdapter, where };
          await otherSessionRevocation.run(scope, async () => {
            // Keep the provider's deletion hooks and secondary-cache cleanup.
            // The token list is only for those effects, never the bulk predicate.
            if (sessions.length) {
              await remove(sessions.map((session) => session.token));
            } else {
              await transactionAdapter.deleteMany({ model: "session", where });
            }
          });
        });
      },
      async findMany<T>(data: Parameters<DBAdapter["findMany"]>[0]) {
        const scope = otherSessionRevocation.getStore();
        if (data.model !== "session" || !scope)
          return adapter.findMany<T>(data);
        return scope.adapter.findMany<T>({
          ...data,
          limit: Number.MAX_SAFE_INTEGER,
        });
      },
      async delete<T>(data: Parameters<DBAdapter["delete"]>[0]) {
        if (data.model !== "session") return adapter.delete<T>(data);
        const scope = otherSessionRevocation.getStore();
        if (scope) return scope.adapter.delete<T>(data);
        return deleteSessions(data, (transactionAdapter) =>
          transactionAdapter.delete<T>(data),
        );
      },
      async deleteMany(data: Parameters<DBAdapter["deleteMany"]>[0]) {
        if (data.model !== "session") return adapter.deleteMany(data);
        const scope = otherSessionRevocation.getStore();
        if (scope) {
          return scope.adapter.deleteMany({ ...data, where: scope.where });
        }
        return deleteSessions(data, (transactionAdapter) =>
          transactionAdapter.deleteMany(data),
        );
      },
      async update<T>(data: Parameters<DBAdapter["update"]>[0]) {
        if (
          data.model !== "user" ||
          !Object.hasOwn(data.update, "role") ||
          hasInstanceAdminRole(data.update.role)
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

          if (hasInstanceAdminRole(user?.role)) {
            const [admins] = await tx
              .select({ value: count() })
              .from(schema.userTable)
              .where(instanceAdminRoleSql(schema.userTable.role));
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

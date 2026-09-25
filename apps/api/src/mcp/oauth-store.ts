import { and, count, eq, gt, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { mcpOauthStateTable } from "../database/schema";

export type OauthStateKind = "client" | "code" | "request";
export const OAUTH_STATE_LIMITS = {
  client: { rows: 1_000, perMinute: 60, perClient: 0, lock: 1 },
  request: { rows: 10_000, perMinute: 300, perClient: 20, lock: 2 },
  code: { rows: 10_000, perMinute: 300, perClient: 20, lock: 3 },
} as const;
export const OAUTH_PAYLOAD_BYTES = 32 * 1024;
export const EXPIRED_STATE_BATCH = 100;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function sweepExpired(dbOrTx: typeof db | Transaction) {
  // Never issue an unbounded delete or evict a live consent request. Fixed
  // rate-counter rows are reused rather than accumulated per time window.
  await dbOrTx.execute(sql`
    DELETE FROM ${mcpOauthStateTable} WHERE id IN (
      SELECT id FROM ${mcpOauthStateTable}
      WHERE kind <> 'rate' AND expires_at <= now()
      ORDER BY expires_at LIMIT ${EXPIRED_STATE_BATCH}
      FOR UPDATE SKIP LOCKED
    )
  `);
}

export async function putState(
  kind: OauthStateKind,
  key: string,
  payload: unknown,
  expiresAt: Date,
  consumeRequestId?: string,
): Promise<void> {
  const serialized = JSON.stringify(payload);
  if (
    typeof serialized !== "string" ||
    Buffer.byteLength(serialized) > OAUTH_PAYLOAD_BYTES ||
    key.length > 128
  ) {
    throw new HTTPException(413, { message: "OAuth state is too large" });
  }
  const clientId =
    payload && typeof payload === "object" && "clientId" in payload
      ? payload.clientId
      : undefined;
  const limits = OAUTH_STATE_LIMITS[kind];
  const denial = await db.transaction(async (tx) => {
    // Separate fixed locks keep a registration flood from occupying the code
    // issuance lock. Try-lock bounds the queue during concurrent floods.
    const lock = await tx.execute<{ acquired: boolean; nowMs: number }>(
      sql`SELECT pg_try_advisory_xact_lock(773621, ${limits.lock}) AS acquired, (extract(epoch FROM now()) * 1000)::double precision AS "nowMs"`,
    );
    if (!lock.rows[0]?.acquired) return "busy";
    const now = new Date(Number(lock.rows[0].nowMs));
    await sweepExpired(tx);
    const [rate] = await tx
      .select()
      .from(mcpOauthStateTable)
      .where(
        and(
          eq(mcpOauthStateTable.kind, "rate"),
          eq(mcpOauthStateTable.key, kind),
        ),
      )
      .limit(1);
    const used =
      rate && rate.expiresAt > now
        ? Number((rate.payload as { count?: number }).count ?? 0)
        : 0;
    if (!Number.isSafeInteger(used) || used < 0 || used >= limits.perMinute)
      return "rate";
    const [total] = await tx
      .select({ total: count() })
      .from(
        tx
          .select({ id: mcpOauthStateTable.id })
          .from(mcpOauthStateTable)
          .where(eq(mcpOauthStateTable.kind, kind))
          .limit(limits.rows)
          .as("bounded_states"),
      );
    if ((total?.total ?? limits.rows) >= limits.rows) return "capacity";
    if (limits.perClient && typeof clientId === "string") {
      const [clientTotal] = await tx.select({ total: count() }).from(
        tx
          .select({ id: mcpOauthStateTable.id })
          .from(mcpOauthStateTable)
          .where(
            and(
              eq(mcpOauthStateTable.kind, kind),
              sql`${mcpOauthStateTable.payload}->>'clientId' = ${clientId}`,
            ),
          )
          .limit(limits.perClient)
          .as("bounded_client_states"),
      );
      if ((clientTotal?.total ?? limits.perClient) >= limits.perClient)
        return "client";
    }
    if (consumeRequestId) {
      const consumed = await tx
        .delete(mcpOauthStateTable)
        .where(
          and(
            eq(mcpOauthStateTable.kind, "request"),
            eq(mcpOauthStateTable.key, consumeRequestId),
            gt(mcpOauthStateTable.expiresAt, now),
          ),
        )
        .returning({ id: mcpOauthStateTable.id });
      if (!consumed.length) return "missing-request";
    }
    await tx
      .insert(mcpOauthStateTable)
      .values({ kind, key, payload, expiresAt });
    const rateExpires = new Date(
      (Math.floor(now.getTime() / 60_000) + 1) * 60_000,
    );
    await tx
      .insert(mcpOauthStateTable)
      .values({
        kind: "rate",
        key: kind,
        payload: { count: used + 1 },
        expiresAt: rateExpires,
      })
      .onConflictDoUpdate({
        target: [mcpOauthStateTable.kind, mcpOauthStateTable.key],
        set: { payload: { count: used + 1 }, expiresAt: rateExpires },
      });
    return null;
  });
  // Return denials outside the transaction: expired-row cleanup must commit
  // even when a legacy over-cap table refuses this insert.
  if (denial === "missing-request")
    throw new HTTPException(404, {
      res: Response.json(
        { error: "invalid_or_expired_request" },
        { status: 404 },
      ),
    });
  if (denial)
    throw new HTTPException(429, {
      res: Response.json(
        {
          error: "temporarily_unavailable",
          error_description: "OAuth capacity reached; retry later",
        },
        {
          status: 429,
          headers: {
            "Retry-After": denial === "busy" ? "1" : "60",
            "Cache-Control": "no-store",
          },
        },
      ),
    });
}

export async function getState<T>(
  kind: OauthStateKind,
  key: string,
): Promise<T | null> {
  const [row] = await db
    .select()
    .from(mcpOauthStateTable)
    .where(
      and(eq(mcpOauthStateTable.kind, kind), eq(mcpOauthStateTable.key, key)),
    )
    .limit(1);

  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  return row.payload as T;
}

// Single DELETE ... RETURNING keeps consumption single-use across replicas.
export async function consumeState<T>(
  kind: OauthStateKind,
  key: string,
): Promise<T | null> {
  const [row] = await db
    .delete(mcpOauthStateTable)
    .where(
      and(eq(mcpOauthStateTable.kind, kind), eq(mcpOauthStateTable.key, key)),
    )
    .returning();

  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  return row.payload as T;
}

export async function deleteExpiredStates(): Promise<void> {
  await sweepExpired(db);
}

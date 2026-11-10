/**
 * Apply the external side-effect ledger after a database restore.
 *
 * Restoring a backup rewinds the database but not the world. Emails that were
 * sent are still sent, webhooks that were delivered are still delivered, and
 * every column recording those acts has been rewound along with everything
 * else. Call this once, at the end of a restore and before the schedulers are
 * allowed to run, and each column in `side-effect-ledger.ts` gets the policy
 * its consumer needs so nothing is re-sent.
 *
 * The posture is suppress-by-default. Nothing is replayed unless the caller
 * names the exact columns it wants replayed, so forgetting the option gives
 * the safe outcome and asking for a replay is a deliberate act that shows up
 * in the audit metadata.
 *
 * Every statement is written to be a no-op on a second run with the same
 * `restoredTo`, and they all commit in one transaction with the audit row, so
 * the operation is safely repeatable: an interrupted restore can simply run
 * it again.
 *
 * This module deliberately does no logging. It returns a structured report
 * and lets the caller, which owns a logger, record it.
 */
import { and, getTableName, sql, type SQL } from "drizzle-orm";
import { auditLog } from "./schema/audit-log";
import type { Database } from "./client";
import {
  SIDE_EFFECT_LEDGER,
  ledgerColumnKey,
  type LedgerRegistration,
  type SideEffectPolicy,
  type SettleStrategy,
} from "./side-effect-ledger";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Audit taxonomy entry written by every run. Mirrored in AuditEventType. */
export const RESTORE_SETTLEMENT_AUDIT_EVENT = "restore.side_effects_settled";

/**
 * What was done to one registered column.
 *
 * `stamp-pending` / `restart-window` / `clear` carry a statement; `preserve`
 * and `replay` are recorded with no statement so the plan is a complete
 * account of the registry rather than only the parts that ran.
 */
export type SettlementAction = SettleStrategy | "clear" | "preserve" | "replay";

export interface SettlementStep {
  /** `table.column`. */
  readonly key: string;
  readonly table: string;
  readonly column: string;
  readonly policy: SideEffectPolicy;
  readonly action: SettlementAction;
  /** The registry's reason, carried through so the report explains itself. */
  readonly reason: string;
  /** Null for `preserve` and `replay`. */
  readonly statement: SQL | null;
}

export interface SettleExternalSideEffectsOptions {
  /**
   * The instant the restored database became authoritative, normally
   * `new Date()` at the end of the restore. Settled columns are stamped with
   * it, so a ledger never claims an effect happened at a time inside the
   * discarded window, and a cooldown restarts from the restore rather than
   * from a send the restore cannot see.
   */
  readonly restoredTo: Date;
  /**
   * Columns to deliberately leave alone so their effect DOES happen again,
   * as `table.column` keys (`'events.published_at'`). Empty by default:
   * suppression is what a caller gets for saying nothing. Unknown keys throw
   * rather than being ignored, so a typo cannot silently become a replay that
   * did not happen or a suppression that did.
   */
  readonly replay?: readonly string[];
}

export interface AppliedSettlementStep extends SettlementStep {
  readonly rowsAffected: number;
}

export interface SettlementReport {
  readonly restoredTo: Date;
  readonly appliedAt: Date;
  readonly steps: readonly AppliedSettlementStep[];
  readonly totalRowsAffected: number;
  readonly replayed: readonly string[];
  /**
   * When an earlier run already settled this same `restoredTo`, its audit
   * timestamp. The statements are idempotent so the rerun is harmless; this
   * is here to make a duplicate visible rather than to gate on it.
   */
  readonly previouslySettledAt: Date | null;
}

// ---------------------------------------------------------------------------
// Planning (pure)
// ---------------------------------------------------------------------------

/**
 * Build the statement for one settle strategy.
 *
 * Each is phrased so re-running it against its own output matches no rows:
 * `stamp-pending` only fills NULLs it just filled, `restart-window` only
 * moves values strictly older than the stamp it just wrote, `clear` only
 * clears values it just set to NULL. The count comes back through a CTE so
 * one row is returned regardless of how many were touched.
 */
function countingUpdate(table: unknown, assignment: SQL, predicate: SQL): SQL {
  return sql`WITH settled AS (UPDATE ${table} SET ${assignment} WHERE ${predicate} RETURNING 1) SELECT count(*)::int AS rows_affected FROM settled`;
}

/**
 * The full account of what a restore would do, without doing it. Useful as a
 * dry run and as the thing the executor walks.
 */
export function planSideEffectSettlement(
  opts: SettleExternalSideEffectsOptions,
  /**
   * The registry to plan against. Defaults to the real one. Overridden only by
   * tests, so that each executor branch stays covered by its own fixture
   * rather than by whichever real column happens to carry that policy today.
   * Reclassifying a column is then a registry decision, not a test rewrite.
   */
  registry: readonly LedgerRegistration[] = SIDE_EFFECT_LEDGER,
): SettlementStep[] {
  const replay = new Set(opts.replay ?? []);
  const known = new Set(registry.map((entry) => ledgerColumnKey(entry.column)));
  const unknown = [...replay].filter((key) => !known.has(key));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown replay target(s): ${unknown.join(", ")}. ` +
        `Replay keys are 'table.column' handles of columns registered in SIDE_EFFECT_LEDGER.`,
    );
  }

  const stampAt = opts.restoredTo;

  return registry.map((entry): SettlementStep => {
    const { column } = entry;
    const key = ledgerColumnKey(column);
    const table = getTableName(column.table);
    const target = sql.identifier(column.name);
    const base = {
      key,
      table,
      column: column.name,
      policy: entry.policy,
      reason: entry.reason,
    };

    if (replay.has(key)) {
      return { ...base, action: "replay", statement: null };
    }

    if (entry.policy === "preserve") {
      return { ...base, action: "preserve", statement: null };
    }

    if (entry.policy === "reset") {
      return {
        ...base,
        action: "clear",
        statement: countingUpdate(
          column.table,
          sql`${target} = NULL`,
          sql`${column} IS NOT NULL`,
        ),
      };
    }

    if (entry.strategy === "restart-window") {
      return {
        ...base,
        action: "restart-window",
        statement: countingUpdate(
          column.table,
          sql`${target} = ${stampAt}`,
          sql`${column} IS NULL OR ${column} < ${stampAt}`,
        ),
      };
    }

    // "Pending" is the rows the consumer would have drained at the restore
    // instant, which is only `IS NULL` when the consumer tests nothing else.
    // Where it tests more, stamping the difference does not suppress a repeat,
    // it cancels an effect that had not happened yet.
    const pending = entry.eligibleWhen
      ? and(sql`${column} IS NULL`, entry.eligibleWhen(stampAt))!
      : sql`${column} IS NULL`;
    return {
      ...base,
      action: "stamp-pending",
      statement: countingUpdate(
        column.table,
        sql`${target} = ${stampAt}`,
        pending,
      ),
    };
  });
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

async function findPreviousSettlement(
  tx: Tx,
  restoredTo: Date,
): Promise<Date | null> {
  const rows = (
    await tx.execute<{ occurred_at: string | Date }>(sql`
      SELECT occurred_at
      FROM ${auditLog}
      WHERE event_type = ${RESTORE_SETTLEMENT_AUDIT_EVENT}
        AND metadata ->> 'restoredTo' = ${restoredTo.toISOString()}
      ORDER BY occurred_at DESC
      LIMIT 1
    `)
  ).rows;
  const occurredAt = rows[0]?.occurred_at;
  return occurredAt ? new Date(occurredAt) : null;
}

/**
 * Apply every registered policy in one transaction and record the run.
 *
 * The restore marker is an `audit_log` row rather than a new table or column:
 * the statements are individually idempotent, so the marker's job is
 * auditability and duplicate detection, not correctness gating, and
 * `audit_log` is already the append-only home for operator actions on this
 * instance. Nothing else needed to change to get it.
 *
 * Returns the per-column outcome. No restore path exists in this repo yet;
 * whichever one lands calls this once, after the data is in place and before
 * any scheduler or worker is allowed to run against it.
 */
export async function settleExternalSideEffects(
  db: Database,
  opts: SettleExternalSideEffectsOptions,
): Promise<SettlementReport> {
  const steps = planSideEffectSettlement(opts);
  const replayed = steps.filter((s) => s.action === "replay").map((s) => s.key);
  const appliedAt = new Date();

  return db.transaction(async (tx) => {
    const previouslySettledAt = await findPreviousSettlement(
      tx,
      opts.restoredTo,
    );

    const applied: AppliedSettlementStep[] = [];
    for (const step of steps) {
      if (step.statement === null) {
        applied.push({ ...step, rowsAffected: 0 });
        continue;
      }
      const rows = (await tx.execute<{ rows_affected: number }>(step.statement))
        .rows;
      applied.push({
        ...step,
        rowsAffected: Number(rows[0]?.rows_affected ?? 0),
      });
    }

    const totalRowsAffected = applied.reduce(
      (sum, step) => sum + step.rowsAffected,
      0,
    );

    await tx.insert(auditLog).values({
      occurredAt: appliedAt,
      eventType: RESTORE_SETTLEMENT_AUDIT_EVENT,
      eventOutcome: "success",
      actorType: "system",
      targetType: "database",
      metadata: {
        restoredTo: opts.restoredTo.toISOString(),
        appliedAt: appliedAt.toISOString(),
        totalRowsAffected,
        replayed,
        previouslySettledAt: previouslySettledAt?.toISOString() ?? null,
        steps: applied.map((step) => ({
          key: step.key,
          policy: step.policy,
          action: step.action,
          rowsAffected: step.rowsAffected,
        })),
      },
    });

    return {
      restoredTo: opts.restoredTo,
      appliedAt,
      steps: applied,
      totalRowsAffected,
      replayed,
      previouslySettledAt,
    };
  });
}

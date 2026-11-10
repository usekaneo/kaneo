/**
 * The external side-effect ledger.
 *
 * A database restore rewinds internal state. It cannot rewind an email that
 * was already sent, a webhook that was already delivered, or a changelog that
 * was already announced. Every column that records "we already did an
 * externally visible thing" becomes a lie the moment the rows around it are
 * rewound, and the next scheduler tick believes the lie and does the thing
 * again: the subscriber list gets the whole backlog a second time, the
 * receiver gets every webhook in the restored window a second time, a resend
 * cooldown that had not expired is suddenly open again.
 *
 * This file is the one place that decides, per column, what a restore should
 * do about it. `settleExternalSideEffects` (settle-external-side-effects.ts)
 * is the only consumer; it applies every policy here in a single transaction.
 *
 * The registry is keyed per COLUMN, never per table, because one table
 * routinely carries both kinds. `changelog_entries.published_at` is content
 * state and must come back exactly as it was; `changelog_entries.notified_at`
 * on the same row is a delivery receipt and must be settled or the backlog is
 * re-announced. Migration 0120 backfilled `notified_at` for precisely this
 * reason, arriving from a different direction.
 *
 * ## Adding a column
 *
 * The guard test (`__tests__/side-effect-ledger.test.ts`) fails when a
 * ledger-shaped column exists in the schema and appears in neither
 * `SIDE_EFFECT_LEDGER` nor `SIDE_EFFECT_LEDGER_EXEMPTIONS`. To classify one,
 * find the query that READS it and ask what a rewind makes that query do:
 *
 * - A scheduler drains rows where it IS NULL, and draining sends something
 *   outbound -> `settle` with `'stamp-pending'`.
 * - It is a rate-limit or cooldown watermark, so an older value re-opens a
 *   window -> `settle` with `'restart-window'`.
 * - It is the data itself, or restoring it verbatim is what the operator
 *   wants -> `preserve`.
 * - It is internal freshness telemetry whose pre-restore value is not
 *   evidence about the live system -> `reset`.
 * - Nothing reads it, or it is not a record of an external action at all ->
 *   `SIDE_EFFECT_LEDGER_EXEMPTIONS`, with a reason naming what would have to
 *   change for it to become a hazard.
 *
 * The `reason` is load-bearing. It is what the next engineer reads to
 * classify their own column, so name the consumer and the consequence, not
 * the policy.
 */
import {
  and,
  getTableColumns,
  getTableName,
  is,
  isNotNull,
  lte,
  type SQL,
} from "drizzle-orm";
import { PgTable, type PgColumn } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/**
 * What a restore does to a ledger column.
 *
 * - `settle`   stamp it so the recorded effect counts as already taken and is
 *              not repeated. The default posture.
 * - `preserve` restore it verbatim. Either it is the data, or settling it
 *              would cause a worse failure than the replay it prevents.
 * - `reset`    clear it, so the work behind it happens again. Only for work
 *              with no externally visible effect.
 */
export type SideEffectPolicy = "settle" | "preserve" | "reset";

/**
 * How a `settle` column is stamped.
 *
 * - `stamp-pending`  fill rows where the column IS NULL. For "have we done it
 *                    yet" receipts, where NULL is the scheduler's work queue.
 *                    Rows that already carry a stamp keep their real one, so
 *                    the historical record of when the effect happened
 *                    survives the restore.
 * - `restart-window` push every value that is older than the restore forward
 *                    to it. For rate-limit and cooldown watermarks, where the
 *                    hazard is a stale value rather than a missing one: the
 *                    window is measured from the restore instead of from a
 *                    send that the restore cannot see.
 */
export type SettleStrategy = "stamp-pending" | "restart-window";

export type LedgerRegistration =
  | {
      readonly column: PgColumn;
      readonly policy: "settle";
      readonly strategy: SettleStrategy;
      readonly reason: string;
      /**
       * Narrows `stamp-pending` to the rows the scheduler would actually have
       * drained at the restore instant, receiving that instant so the
       * predicate can compare against it.
       *
       * A bare `IS NULL` is only an approximation of "pending", and where the
       * consumer applies further conditions the approximation is dangerous in
       * one direction: it stamps rows that were never eligible, which disarms
       * the effect for good. A draft that is published a week after the
       * restore must still announce itself, so its NULL is not the
       * scheduler's backlog and must not be filled. Supply this wherever the
       * consuming query tests more than the column itself.
       */
      readonly eligibleWhen?: (restoredTo: Date) => SQL;
    }
  | {
      readonly column: PgColumn;
      readonly policy: "preserve";
      readonly reason: string;
    }
  | {
      readonly column: PgColumn;
      readonly policy: "reset";
      readonly reason: string;
    };

export interface LedgerExemption {
  readonly column: PgColumn;
  readonly reason: string;
}

/** Stable `table.column` handle for a registered column. */
export function ledgerColumnKey(column: PgColumn): string {
  return `${getTableName(column.table)}.${column.name}`;
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

export const SIDE_EFFECT_LEDGER: readonly LedgerRegistration[] = [
  // -- settle: outbound receipts the scheduler drains ------------------------
  {
    column: schema.events.publishedAt,
    policy: "settle",
    strategy: "stamp-pending",
    reason:
      "event-dispatch drains unpublished job-owned events through the events_unpublished_idx partial index and fans each row out to the hook queue, so a rewind re-delivers every webhook in the restored window.",
  },
  {
    column: schema.changelogEntries.notifiedAt,
    policy: "settle",
    strategy: "stamp-pending",
    reason:
      "The publish reconciler announces entries with notified_at IS NULL that are already live, so a rewind emails the published backlog to subscribers a second time. Scoped to entries that were live at the restore: a bare IS NULL would also stamp drafts and future-dated entries, and because the claim query requires notified_at IS NULL, that would silently disarm their announcement forever.",
    eligibleWhen: (restoredTo) =>
      and(
        isNotNull(schema.changelogEntries.publishedAt),
        lte(schema.changelogEntries.publishedAt, restoredTo),
      )!,
  },
  {
    column: schema.statusIncidents.notifiedAt,
    policy: "settle",
    strategy: "stamp-pending",
    reason:
      "The incident reconciler announces live, unclaimed incidents and maintenance the same way the changelog one does, so a rewind re-notifies subscribers about incidents they already heard about.",
  },
  {
    column: schema.postMentions.notifiedAt,
    policy: "settle",
    strategy: "stamp-pending",
    reason:
      "Insurance, not a live fix. The mention rows are dispatched and stamped inside the same synchronous call and nothing scans later for unstamped rows, so today a rewind re-notifies nobody. Settling costs nothing and closes the hazard the moment mention delivery moves to a worker that drains on IS NULL.",
  },
  {
    column: schema.conversationMessageMentions.notifiedAt,
    policy: "settle",
    strategy: "stamp-pending",
    reason:
      "Same shape and same reasoning as post_mentions, for @-mentions inside internal notes: stamped synchronously after dispatch, with no drain reading it today.",
  },
  // -- preserve: this is the data -------------------------------------------
  {
    column: schema.emailSesTenants.pausedNotifiedAt,
    policy: "preserve",
    reason:
      "The once-per-pause claim for an in-app notice, not an outbound send. It comes back together with sending_status on the same row, and the hourly reconcile re-reads the live status from the provider: a pause still in force keeps its claim, and a resume re-arms it. Settling it could swallow the notice for a pause that began after the backup. Reclassify if it ever gates an email.",
  },
  {
    column: schema.changelogEntries.publishedAt,
    policy: "preserve",
    reason:
      "Publication state of the entry, not a record of anything sent. Settling it would fabricate publications; the announcement receipt on the same row is notified_at.",
  },
  {
    column: schema.helpCenterArticles.publishedAt,
    policy: "preserve",
    reason:
      "Publication state of the article. Nothing is dispatched off it, so a rewind changes what is visible in the help center and nothing else.",
  },

  {
    column: schema.integrationSyncOperations.dispatchedAt,
    policy: "preserve",
    reason:
      "Evidence of a possibly applied remote change, read by lease recovery and retry fencing. Clearing it would permit duplicate writes. Restores must keep integration workers paused and quarantine pending operations before resuming, since no snapshot can recover evidence written after it.",
  },

  // -- preserve: settling would cause the worse failure ---------------------
  {
    column: schema.onboardingEmails.sentAt,
    policy: "preserve",
    reason:
      "The dedupe fact is the ROW, not the stamp: a setup email is never sent twice because its (principal, kind) row exists. Nothing reads sent_at. A rewind that loses a row can re-send at most one setup email, and only inside the 14-day launch window; no column policy can repair a missing row.",
  },
  {
    column: schema.hookDeliveries.processedAt,
    policy: "preserve",
    reason:
      "The dedupe fact is the ROW, not the stamp; the stamp only expires a five-minute processing lease and drives pruning. Deliveries recorded after the snapshot are gone along with their rows, which no column policy can repair, and stamping the survivors forward would only delay legitimate crash recovery.",
  },
  {
    column: schema.unsubscribeTokens.usedAt,
    policy: "preserve",
    reason:
      "Single-use consumption. A rewind re-arms a token spent after the snapshot, but settling would mark every unspent token used and break the unsubscribe link in every email already delivered, which is the worse failure and the one people notice.",
  },

  // -- preserve: no consumer gates on it ------------------------------------
  {
    column: schema.webhooks.lastTriggeredAt,
    policy: "preserve",
    reason:
      "Delivery history rendered in the webhooks settings list. Nothing schedules off it, and restoring it verbatim keeps it consistent with the restored events log it summarises. This is the rule for every display-only recency stamp here: preserve, because a restore should not destroy data it does not have to.",
  },
  {
    column: schema.postSentiment.processedAt,
    policy: "preserve",
    reason:
      "Internal analysis stamp with no outbound effect; the pipeline keys on the row existing, not on this value. It is also NOT NULL, so it can be neither settled nor reset.",
  },
  {
    column: schema.emailSendingDomains.lastCheckedAt,
    policy: "preserve",
    reason:
      "Written only alongside a successful DNS verification, and no sweep polls on it. It is a display companion to verified_at.",
  },
  {
    column: schema.assistantPendingActions.executedAt,
    policy: "preserve",
    reason:
      "The record of an action the assistant already carried out. Nothing scans for approved-but-unexecuted rows, so a rewind does not re-execute anything; the stamp is evidence, not a work queue.",
  },

  {
    column: schema.integrations.lastOutboundAt,
    policy: "preserve",
    reason:
      "Display-only health telemetry, same rule as webhooks.last_triggered_at: nothing schedules off it, so a restore has no reason to destroy it. The value is old rather than false, and after a restore so is everything beside it. Clearing it would also empty the integration health panel, which hides itself when both stamps are null and there is no error, so a reset trades a stale reading for no reading at all.",
  },
  {
    column: schema.integrations.lastInboundAt,
    policy: "preserve",
    reason:
      "Inbound twin of last_outbound_at, feeding the same panel under the same rule.",
  },
  {
    column: schema.connectors.lastSyncedAt,
    policy: "reset",
    reason:
      "When the remote MCP tool catalogue was last refreshed. Nothing outbound reads it — sync is operator-initiated or scheduled against the remote, not drained on IS NULL — so after a restore an older value merely reports the catalogue as staler than it is, and the next sync overwrites it.",
  },
];

// ---------------------------------------------------------------------------
// Exemptions
// ---------------------------------------------------------------------------

/**
 * Columns that look like ledgers to the guard but are not. Every entry must
 * say what would have to change for it to become one, so a later wiring
 * change gets reclassified instead of quietly inheriting the exemption.
 */
export const SIDE_EFFECT_LEDGER_EXEMPTIONS: readonly LedgerExemption[] = [
  {
    column: schema.assistantInvolvements.escalationOfferedAt,
    reason:
      "Declared but not wired: no code writes it and no code reads it, so there is nothing for a restore to get wrong. Reclassify as settle with stamp-pending the moment an escalation path starts draining it, because a rewound stamp would then offer a human a second time to a conversation that already had the offer.",
  },
  {
    column: schema.integrations.lastSyncAt,
    reason:
      "Declared in the initial migration and never wired: no writer and no reader anywhere in the tree. Reclassify as settle the moment a poll-based sync starts stamping it, because a rewound sync cursor re-pushes stale state outbound.",
  },
];

// ---------------------------------------------------------------------------
// Ledger shape detection (the anti-rot mechanism)
// ---------------------------------------------------------------------------

/**
 * Column-name shapes that read as "an externally visible action happened".
 *
 * Deliberately name-based: the point is to catch a column the author has not
 * thought about yet, and at that moment the name is the only signal that
 * exists. Widen these when a new naming habit appears; every column a pattern
 * newly matches then has to be classified, which is the intended cost.
 *
 * Two shapes are structurally invisible here, so a green run means "nothing
 * NAMED like a ledger is unclassified", not "nothing is missed":
 *
 * - Non-timestamp flags. A `reminder_sent boolean` or a `notify_count integer`
 *   records the same fact and matches nothing below. There are none today.
 * - Stamps nested inside jsonb. The SLA machinery already keeps applied and
 *   paused instants inside the `sla_applied` document, and column metadata
 *   cannot reach into it.
 *
 * If you add either shape, register it by hand: the guard will not ask you to.
 */
export const LEDGER_COLUMN_PATTERNS: readonly RegExp[] = [
  // "we sent / delivered / announced it": an outbound act, completed.
  /(?:^|_)(notified|sent|delivered|announced|dispatched|emailed|pushed|published|broadcast)_at$/,
  // "the last time we reached out": an outbound cursor a scheduler resumes from.
  /^last_(sync|synced|triggered|outbound|inbound|checked|attempted|attempt|run|polled|poll)_at$/,
  // "this was consumed / carried out once": a one-shot that must not re-arm.
  // `last_*` is excluded here so plain recency stamps (last_used_at,
  // last_seen_at) do not masquerade as one-shot ledgers.
  /^(?!last_).*(?:^|_)(processed|executed|offered|used)_at$/,
];

/** Does this SQL column name read as a record of an external action? */
export function isLedgerShapedColumnName(name: string): boolean {
  return LEDGER_COLUMN_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Every ledger-shaped column in a set of Drizzle tables, as `table.column`
 * keys. Takes the module namespace of a schema barrel (the real one by
 * default) so a test can point it at a fixture.
 */
export function collectLedgerShapedColumns(
  tables: Record<string, unknown> = schema,
): string[] {
  const keys: string[] = [];
  for (const candidate of Object.values(tables)) {
    if (!is(candidate, PgTable)) continue;
    const tableName = getTableName(candidate);
    for (const column of Object.values(getTableColumns(candidate))) {
      if (isLedgerShapedColumnName(column.name))
        keys.push(`${tableName}.${column.name}`);
    }
  }
  return [...new Set(keys)].sort();
}

/** Every `table.column` key the registry or the exemption list accounts for. */
export function classifiedLedgerColumns(): Set<string> {
  return new Set([
    ...SIDE_EFFECT_LEDGER.map((entry) => ledgerColumnKey(entry.column)),
    ...SIDE_EFFECT_LEDGER_EXEMPTIONS.map((entry) =>
      ledgerColumnKey(entry.column),
    ),
  ]);
}

/**
 * Ledger-shaped columns in the schema that nobody has classified. The guard
 * test fails on a non-empty result.
 */
export function findUnclassifiedLedgerColumns(
  tables: Record<string, unknown> = schema,
): string[] {
  const classified = classifiedLedgerColumns();
  return collectLedgerShapedColumns(tables).filter(
    (key) => !classified.has(key),
  );
}

/**
 * Registry or exemption entries whose column no longer looks like a ledger,
 * which means either the column was renamed or the patterns were narrowed.
 * Either way the entry is now decoration and should be removed or the pattern
 * restored.
 */
export function findStaleLedgerClassifications(
  tables: Record<string, unknown> = schema,
): string[] {
  const shaped = new Set(collectLedgerShapedColumns(tables));
  return [...classifiedLedgerColumns()]
    .filter((key) => !shaped.has(key))
    .sort();
}

/** What to do about an unclassified column, printed by the guard on failure. */
export const LEDGER_CLASSIFICATION_INSTRUCTIONS = [
  "Each column above records something externally visible and no restore policy claims it.",
  "Read the query that CONSUMES the column, then add it to packages/db/src/side-effect-ledger.ts:",
  "  settle  + 'stamp-pending'  a scheduler drains rows where it IS NULL and sends something outbound",
  "  settle  + 'restart-window' it is a rate limit or cooldown, so an older value re-opens a send window",
  "  preserve                   it is the data itself, or settling it breaks something worse",
  "  reset                      internal freshness telemetry with no externally visible effect",
  "If it is not a side-effect ledger at all (nothing reads it, or it records no outbound act),",
  "add it to SIDE_EFFECT_LEDGER_EXEMPTIONS in the same file with a reason saying what would have",
  "to change for it to become one.",
].join("\n");

/**
 * Visitor analytics rollup: recompute recent visitor_stats_daily rows and the
 * visitor_top_stats snapshots from the raw page_views partitions.
 *
 * Called hourly. Recomputes today AND yesterday (UTC) so the final hour
 * before midnight is never lost between runs; historical rows are immutable.
 * Dashboards only ever read the rollup tables, so query cost stays flat no
 * matter how many raw events exist.
 *
 * Uniques note: a visitor's hash differs each day (daily salt), so summing
 * daily uniques over a range equals a distinct count over the raw rows —
 * the rollup-only read path loses nothing.
 */
import { sql } from "drizzle-orm";
import type { Database } from "./client";
import {
  visitorStatsDaily,
  visitorTopStats,
  VISITOR_SURFACES,
} from "./schema/visitor-analytics";

const SESSION_GAP = "30 minutes";
const TOP_N = 10;

export const VISITOR_PERIODS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "12m": 365,
};

function utcDay(now: Date, offsetDays: number): string {
  const d = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

interface DayStats {
  surface: string;
  uniqueVisitors: number;
  pageviews: number;
  visits: number;
}

/**
 * One day's stats for every surface scope in a single pass: per-surface rows
 * via GROUP BY, plus the 'all' scope where sessions collapse across surfaces.
 */
async function computeDayStats(
  db: Database,
  date: string,
): Promise<DayStats[]> {
  // A visit opens where a visitor's gap since their previous event exceeds
  // the session gap. Both scopes (per-surface and 'all') are computed from
  // one pass via named windows. Note the 'all' scope can only dedupe a
  // visitor across surfaces when they share a site_origin (e.g. the widget
  // embedded on the portal itself): distinct origins hash to distinct
  // visitor keys by design, so 'all' is otherwise the per-surface sum.
  const result = await db.execute(sql`
    WITH scoped AS (
      SELECT surface, visitor_hash, occurred_at
      FROM quills."page_views"
      WHERE occurred_at >= ${date}::date AND occurred_at < ${date}::date + 1
    ),
    gaps AS (
      SELECT surface, visitor_hash,
        CASE WHEN lag(occurred_at) OVER surface_w IS NULL
          OR occurred_at - lag(occurred_at) OVER surface_w > interval '${sql.raw(SESSION_GAP)}'
        THEN 1 ELSE 0 END AS surface_new,
        CASE WHEN lag(occurred_at) OVER all_w IS NULL
          OR occurred_at - lag(occurred_at) OVER all_w > interval '${sql.raw(SESSION_GAP)}'
        THEN 1 ELSE 0 END AS all_new
      FROM scoped
      WINDOW surface_w AS (PARTITION BY surface, visitor_hash ORDER BY occurred_at),
             all_w AS (PARTITION BY visitor_hash ORDER BY occurred_at)
    )
    SELECT surface,
      count(DISTINCT visitor_hash)::int AS uniques,
      count(*)::int AS pageviews,
      sum(surface_new)::int AS visits
    FROM gaps
    GROUP BY surface
    UNION ALL
    SELECT 'all' AS surface,
      count(DISTINCT visitor_hash)::int AS uniques,
      count(*)::int AS pageviews,
      sum(all_new)::int AS visits
    FROM gaps
    HAVING count(*) > 0
  `);
  return Array.from(
    result.rows as Iterable<{
      surface: string;
      uniques: number;
      pageviews: number;
      visits: number;
    }>,
  ).map((r) => ({
    surface: r.surface,
    uniqueVisitors: r.uniques,
    pageviews: r.pageviews,
    visits: r.visits,
  }));
}

interface TopRow {
  dimension: string;
  label: string;
  visitors: number;
}

const DIMENSION_COLUMNS: Record<string, string> = {
  page: "path",
  source: "source",
  country: "country",
  device: "device",
  browser: "browser",
  os: "os",
};

/** Top-N labels per dimension for one (period, surface) scope, visitor-ranked. */
async function computeTopStats(
  db: Database,
  fromDate: string,
  surface: string,
): Promise<TopRow[]> {
  const surfaceFilter = surface === "all" ? "" : `AND surface = '${surface}'`;
  const blocks = Object.entries(DIMENSION_COLUMNS).map(
    ([dimension, column]) => `(
      SELECT '${dimension}' AS dimension, ${column} AS label, count(DISTINCT visitor_hash)::int AS visitors
      FROM quills."page_views"
      WHERE occurred_at >= '${fromDate}'::date AND ${column} IS NOT NULL ${surfaceFilter}
      GROUP BY ${column}
      ORDER BY visitors DESC, label ASC
      LIMIT ${TOP_N}
    )`,
  );
  const result = await db.execute(
    sql.raw(
      `SELECT * FROM (${blocks.join(" UNION ALL ")}) t ORDER BY dimension, visitors DESC, label ASC`,
    ),
  );
  return Array.from(result.rows as Iterable<TopRow>);
}

/** Recompute today + yesterday daily rows and all top-stat snapshots. */
export async function refreshVisitorAnalytics(
  db: Database,
  opts?: { now?: Date },
): Promise<void> {
  const now = opts?.now ?? new Date();

  // Daily rows: both days recompute concurrently, one multi-row upsert each.
  await Promise.all(
    [-1, 0].map(async (offset) => {
      const date = utcDay(now, offset);
      const stats = await computeDayStats(db, date);
      const rows = VISITOR_SURFACES.map((surface) => {
        const row = stats.find((s) => s.surface === surface);
        return {
          date,
          surface,
          uniqueVisitors: row?.uniqueVisitors ?? 0,
          pageviews: row?.pageviews ?? 0,
          visits: row?.visits ?? 0,
          computedAt: new Date(),
        };
        // Days with no traffic get zero rows only while recomputed (today or
        // yesterday); truly empty historical days simply have no row.
      }).filter((row) => !(offset === -1 && row.pageviews === 0));
      if (rows.length === 0) return;
      await db
        .insert(visitorStatsDaily)
        .values(rows)
        .onConflictDoUpdate({
          target: [
            visitorStatsDaily.workspaceId,
            visitorStatsDaily.date,
            visitorStatsDaily.surface,
          ],
          set: {
            uniqueVisitors: sql`excluded.unique_visitors`,
            pageviews: sql`excluded.pageviews`,
            visits: sql`excluded.visits`,
            computedAt: sql`excluded.computed_at`,
          },
        });
    }),
  );

  // Top snapshots: all (period, surface) scans are independent reads, so they
  // run concurrently (bounded by the pool); each period then swaps its
  // snapshot rows in one transaction.
  await Promise.all(
    Object.entries(VISITOR_PERIODS).map(async ([period, days]) => {
      const fromDate = utcDay(now, -days);
      const perSurface = await Promise.all(
        VISITOR_SURFACES.map(async (surface) => ({
          surface,
          rows: await computeTopStats(db, fromDate, surface),
        })),
      );

      const snapshots: (typeof visitorTopStats.$inferInsert)[] = [];
      for (const { surface, rows } of perSurface) {
        let currentDimension = "";
        let rank = 0;
        for (const row of rows) {
          if (row.dimension !== currentDimension) {
            currentDimension = row.dimension;
            rank = 0;
          }
          rank += 1;
          snapshots.push({
            period,
            surface,
            dimension: row.dimension,
            rank,
            label: row.label,
            count: row.visitors,
            computedAt: new Date(),
          });
        }
      }

      await db.transaction(async (tx) => {
        await tx.delete(visitorTopStats).where(sql`period = ${period}`);
        if (snapshots.length > 0) {
          await tx.insert(visitorTopStats).values(snapshots);
        }
      });
    }),
  );
}

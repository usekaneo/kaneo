import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { getDatabasePool } from "../../apps/api/src/database";
import {
  loadTangledConnection,
  withTangledConnection,
} from "../../apps/api/src/plugins/tangled/connection";
import { withTangledAdmission } from "../../apps/api/src/plugins/tangled/transaction-admission";
import { resetTestDatabase } from "./helpers/database";
import { createTangledFixture } from "./helpers/tangled";

const originalPoolMax = vi.hoisted(() => {
  const previous = process.env.DATABASE_POOL_MAX;
  process.env.DATABASE_POOL_MAX = "3";
  return previous;
});

afterAll(() => {
  if (originalPoolMax === undefined) delete process.env.DATABASE_POOL_MAX;
  else process.env.DATABASE_POOL_MAX = originalPoolMax;
});

beforeEach(async () => {
  await resetTestDatabase();
});

describe("Tangled transaction admission", () => {
  it("rejects excess queued work and releases slots after errors", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const active = Array.from({ length: 2 }, () =>
      withTangledAdmission(async () => held),
    );
    const queued = Array.from({ length: 32 }, () =>
      withTangledAdmission(async () => undefined),
    );
    try {
      await expect(
        withTangledAdmission(async () => undefined),
      ).rejects.toMatchObject({
        status: 503,
      });
    } finally {
      release();
      await Promise.all([...active, ...queued]);
    }
    await expect(
      withTangledAdmission(async () => {
        throw new Error("expected failure");
      }),
    ).rejects.toThrow("expected failure");
    await expect(withTangledAdmission(async () => "available")).resolves.toBe(
      "available",
    );
  });

  it("times out queued work without occupying a later slot", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const active = Array.from({ length: 2 }, () =>
      withTangledAdmission(async () => held),
    );
    try {
      await expect(
        withTangledAdmission(async () => undefined),
      ).rejects.toMatchObject({
        status: 503,
      });
    } finally {
      release();
      await Promise.all(active);
    }
    await expect(withTangledAdmission(async () => "available")).resolves.toBe(
      "available",
    );
  });

  it("leaves a pool connection available while upstream work is slow", async () => {
    const context = await createTangledFixture();
    const connection = await loadTangledConnection(context.integration.id);
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started = 0;
    let enoughStarted!: () => void;
    const startedTwo = new Promise<void>((resolve) => {
      enoughStarted = resolve;
    });
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    const requests = Array.from({ length: 5 }, (_, index) =>
      withTangledConnection(
        connection,
        `refs/heads/test-${index}`,
        async () => {
          started++;
          if (started === 2) enoughStarted();
          await held;
        },
      ),
    );
    try {
      await startedTwo;
      await new Promise((resolve) => setTimeout(resolve, 100));
      const pool = getDatabasePool();
      const poolCounts = () => ({
        max: pool.options.max,
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
        tangledStarted: started,
        tangledNotStarted: requests.length - started,
      });
      const beforeQuery = poolCounts();
      const queryStarted = performance.now();
      const result = await Promise.race([
        db.execute(sql`select 1`).then(() => ({ available: true })),
        new Promise<{ available: false; diagnostics: unknown }>((resolve) => {
          deadlineTimer = setTimeout(() => {
            resolve({
              available: false,
              diagnostics: {
                beforeQuery,
                atDeadline: poolCounts(),
                elapsedMs: Math.round(performance.now() - queryStarted),
              },
            });
          }, 500);
        }),
      ]);
      expect(result.available, JSON.stringify(result)).toBe(true);
    } finally {
      if (deadlineTimer) clearTimeout(deadlineTimer);
      release();
      await Promise.allSettled(requests);
    }
  });
});

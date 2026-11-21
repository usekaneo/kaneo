import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db from "../../apps/api/src/database";
import {
  loadTangledConnection,
  withTangledConnection,
} from "../../apps/api/src/plugins/tangled/connection";
import { resetTestDatabase } from "./helpers/database";
import { createTangledFixture } from "./helpers/tangled";

const originalPoolMax = vi.hoisted(() => {
  const previous = process.env.DATABASE_POOL_MAX;
  process.env.DATABASE_POOL_MAX = "2";
  return previous;
});

afterAll(() => {
  if (originalPoolMax === undefined) delete process.env.DATABASE_POOL_MAX;
  else process.env.DATABASE_POOL_MAX = originalPoolMax;
});

beforeEach(async () => {
  await resetTestDatabase();
});

describe("Tangled admission with a two-connection pool", () => {
  it("keeps one connection available during concurrent slow operations", async () => {
    const context = await createTangledFixture();
    const connection = await loadTangledConnection(context.integration.id);
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const requests = Array.from({ length: 3 }, (_, index) =>
      withTangledConnection(
        connection,
        `refs/heads/test-${index}`,
        async () => {
          started();
          await held;
        },
      ),
    );
    try {
      await firstStarted;
      await new Promise((resolve) => setTimeout(resolve, 100));
      const available = await Promise.race([
        db.execute(sql`select 1`).then(() => true),
        new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), 500),
        ),
      ]);
      expect(available).toBe(true);
    } finally {
      release();
      await Promise.allSettled(requests);
    }
  });
});

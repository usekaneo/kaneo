import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";

// Set this before the lazy database pool opens any connections, including in CI.
vi.stubEnv("PGOPTIONS", "-c timezone=Europe/Paris");
afterAll(() => vi.unstubAllEnvs());

beforeEach(() => resetTestDatabase());

it("stores database-default timestamps as UTC when the session time zone isn't UTC", async () => {
  const timezone = await db.execute<{ timezone: string }>(
    sql`SELECT current_setting('TimeZone') AS timezone`,
  );
  expect(timezone.rows[0]?.timezone).toBe("Europe/Paris");

  const before = Date.now();
  // createdAt is left to the column default.
  await db.insert(schema.verificationTable).values({
    id: "utc-defaults",
    identifier: "utc-defaults",
    value: "value",
    expiresAt: new Date(before + 60_000),
  });
  const after = Date.now();

  const [row] = await db
    .select({ createdAt: schema.verificationTable.createdAt })
    .from(schema.verificationTable)
    .where(eq(schema.verificationTable.id, "utc-defaults"));

  const createdAt = row?.createdAt.getTime() ?? 0;
  expect(createdAt).toBeGreaterThanOrEqual(before - 1_000);
  expect(createdAt).toBeLessThanOrEqual(after + 1_000);
});

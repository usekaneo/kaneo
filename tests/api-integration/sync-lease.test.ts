import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
import { withSyncLease } from "../../apps/api/src/plugins/sync/lease";
import { SyncLeaseBusyError } from "../../apps/api/src/plugins/sync/lease-busy-error";
import { resetTestDatabase } from "./helpers/database";

beforeEach(resetTestDatabase);

it("bounds contention with backoff, preserves another owner's lease, and allows a later retry", async () => {
  const key = "sync-create:crashed-holder";
  await db.insert(schema.jobLeaseTable).values({
    name: key,
    owner: "other-instance",
    expiresAt: new Date(Date.now() + 15 * 60_000),
  });
  const run = vi.fn(async () => "complete");
  const queries = vi.spyOn(getDatabasePool(), "query");
  const started = performance.now();
  await expect(
    withSyncLease(key, run, { maxWaitMs: 120 }),
  ).rejects.toBeInstanceOf(SyncLeaseBusyError);
  expect(performance.now() - started).toBeLessThan(1_000);
  expect(run).not.toHaveBeenCalled();
  expect(queries.mock.calls.length).toBeLessThanOrEqual(4);
  expect((await db.query.jobLeaseTable.findFirst())?.owner).toBe(
    "other-instance",
  );
  await db
    .delete(schema.jobLeaseTable)
    .where(eq(schema.jobLeaseTable.name, key));
  await expect(withSyncLease(key, run, { maxWaitMs: 120 })).resolves.toBe(
    "complete",
  );
  expect(run).toHaveBeenCalledOnce();
  expect(await db.query.jobLeaseTable.findMany()).toHaveLength(0);
});

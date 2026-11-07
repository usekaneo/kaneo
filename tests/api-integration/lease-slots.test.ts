import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import {
  itemLeaseName,
  slotLeaseName,
} from "../../apps/api/src/database/lease-slots";
import {
  GITHUB_IMPORT_LEASE,
  withGithubImportLock,
} from "../../apps/api/src/github-integration/import-lock";
import {
  LABEL_DELETION_LEASE,
  MAX_LABEL_DELETIONS_IN_FLIGHT,
  withLabelDeletionLock,
} from "../../apps/api/src/label/deletion-lock";
import { resetTestDatabase } from "./helpers/database";

beforeEach(resetTestDatabase);

async function advisoryLocks() {
  const result = await db.execute(sql`
    SELECT count(*)::int AS count FROM pg_locks
    WHERE locktype = 'advisory'
      AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
  `);
  return (result.rows[0] as { count: number }).count;
}

async function leaseNames() {
  return (await db.query.jobLeaseTable.findMany())
    .map((lease) => lease.name)
    .sort();
}

const helpers = [
  ["label deletion", LABEL_DELETION_LEASE, withLabelDeletionLock],
  ["GitHub import", GITHUB_IMPORT_LEASE, withGithubImportLock],
] as const;

describe.each(helpers)("%s lock", (_, prefix, withLock) => {
  // Regression for #2167: session advisory locks leaked behind a
  // transaction-mode pooler because the unlock could run on another backend.
  it("holds row leases instead of session advisory locks", async () => {
    const seen = await withLock("target", async () => ({
      locks: await advisoryLocks(),
      leases: await leaseNames(),
    }));
    expect(seen.locks).toBe(0);
    expect(seen.leases).toEqual(
      [slotLeaseName(prefix, 0), itemLeaseName(prefix, "target")].sort(),
    );
    expect(await leaseNames()).toEqual([]);
    expect(await advisoryLocks()).toBe(0);
  });

  it("releases its leases when the operation fails", async () => {
    await expect(
      withLock("target", async () => {
        throw new Error("failed");
      }),
    ).rejects.toThrow("failed");
    expect(await leaseNames()).toEqual([]);
  });

  it("rejects a key whose live lease belongs to another instance and keeps it", async () => {
    await db.insert(schema.jobLeaseTable).values({
      name: itemLeaseName(prefix, "target"),
      owner: "other-instance",
      expiresAt: new Date(Date.now() + 15 * 60_000),
    });
    await expect(
      withLock("target", async () => "must not run"),
    ).rejects.toMatchObject({ status: 429 });
    // The slot claimed before the key check is given back.
    expect(await db.query.jobLeaseTable.findMany()).toEqual([
      expect.objectContaining({
        name: itemLeaseName(prefix, "target"),
        owner: "other-instance",
      }),
    ]);
    await expect(withLock("other", async () => "ok")).resolves.toBe("ok");
  });

  it("takes over leases that a crashed instance left to expire", async () => {
    const expired = new Date(Date.now() - 60_000);
    await db.insert(schema.jobLeaseTable).values([
      { name: slotLeaseName(prefix, 0), owner: "crashed", expiresAt: expired },
      {
        name: itemLeaseName(prefix, "target"),
        owner: "crashed",
        expiresAt: expired,
      },
    ]);
    await expect(withLock("target", async () => "ok")).resolves.toBe("ok");
    expect(await leaseNames()).toEqual([]);
  });
});

it("gives each concurrent label deletion its own slot", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const running = Array.from({ length: MAX_LABEL_DELETIONS_IN_FLIGHT }, (_, i) =>
    withLabelDeletionLock(`label-${i}`, () => gate),
  );
  try {
    await expect.poll(leaseNames).toHaveLength(
      MAX_LABEL_DELETIONS_IN_FLIGHT * 2,
    );
    await expect(
      withLabelDeletionLock("extra", async () => "must not run"),
    ).rejects.toMatchObject({ status: 429 });
  } finally {
    release();
  }
  await Promise.all(running);
  expect(await leaseNames()).toEqual([]);
});

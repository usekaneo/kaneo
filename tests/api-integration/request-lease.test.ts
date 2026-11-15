import { eq, sql } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
import { REQUEST_LEASE_RENEWAL_MS } from "../../apps/api/src/database/request-lease";
import { withRequestLease } from "../../apps/api/src/database/with-request-lease";
import { withGithubImportLock } from "../../apps/api/src/github-integration/import-lock";
import { withLabelDeletionLock } from "../../apps/api/src/label/deletion-lock";
import { resetTestDatabase } from "./helpers/database";

beforeEach(resetTestDatabase);
afterEach(() => vi.useRealTimers());

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe.each([
  ["label-delete", withLabelDeletionLock, 4],
  ["github-import", withGithubImportLock, 2],
] as const)("%s request leases", (scope, withLock, limit) => {
  const resource = `request:${scope}:resource:id`;
  const slot = `request:${scope}:slot:0`;

  it("rejects the same resource without consuming another slot and releases on error", async () => {
    await expect(
      withLock("id", async () => {
        await expect(
          withLock("id", async () => "must not run"),
        ).rejects.toMatchObject({ status: 429 });
        expect(await db.query.jobLeaseTable.findMany()).toHaveLength(2);
        throw new Error("operation failed");
      }),
    ).rejects.toThrow("operation failed");
    expect(await db.query.jobLeaseTable.findMany()).toEqual([]);
    await expect(withLock("id", async () => "retried")).resolves.toBe(
      "retried",
    );
  });

  it("enforces the global cap even for callers without a shared process counter", async () => {
    const gate = deferred();
    const entered: string[] = [];
    const busy = () => new Error("busy");
    const running = Array.from({ length: limit }, (_, i) =>
      withRequestLease(scope, `other-${i}`, limit, busy, async () => {
        entered.push(String(i));
        await gate.promise;
      }),
    );
    try {
      await vi.waitFor(() => expect(entered).toHaveLength(limit));
      await expect(
        withLock("id", async () => "must not run"),
      ).rejects.toMatchObject({ status: 429 });
      expect(await db.query.jobLeaseTable.findMany()).toHaveLength(limit * 2);
    } finally {
      gate.resolve();
      await Promise.all(running);
    }
    expect(await db.query.jobLeaseTable.findMany()).toEqual([]);
    await expect(withLock("id", async () => "available")).resolves.toBe(
      "available",
    );
  });

  it("takes over an expired resource and slot using a fresh execution owner", async () => {
    await db.insert(schema.jobLeaseTable).values(
      [resource, slot].map((name) => ({
        name,
        owner: "crashed",
        expiresAt: sql`timezone('UTC', clock_timestamp()) - interval '1 second'`,
      })),
    );
    let firstOwner: string | undefined;
    await withLock("id", async () => {
      const leases = await db.query.jobLeaseTable.findMany();
      expect(leases).toHaveLength(2);
      firstOwner = leases[0].owner;
      expect(firstOwner).not.toBe("crashed");
      expect(new Set(leases.map((row) => row.owner)).size).toBe(1);
    });
    await withLock("id", async () => {
      expect((await db.query.jobLeaseTable.findFirst())?.owner).not.toBe(
        firstOwner,
      );
    });
    expect(await db.query.jobLeaseTable.findMany()).toEqual([]);
  });

  it.each(["resource", "slot"])(
    "stops after losing the %s and never deletes its successor's lease",
    async (lost) => {
      await expect(
        withLock("id", async (lease) => {
          await db
            .update(schema.jobLeaseTable)
            .set({ owner: "successor" })
            .where(
              eq(
                schema.jobLeaseTable.name,
                lost === "resource" ? resource : slot,
              ),
            );
          await lease.check();
          throw new Error("must not continue");
        }),
      ).rejects.toMatchObject({ status: 429 });
      const remaining = await db.query.jobLeaseTable.findMany();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].owner).toBe("successor");
    },
  );

  it("does not revive an expired lease or run the next database write", async () => {
    const write = vi.fn(async () => {});
    await expect(
      withLock("id", async (lease) => {
        await db.execute(
          sql`UPDATE job_lease SET expires_at = timezone('UTC', clock_timestamp()) - interval '1 second'`,
        );
        await lease.transaction(write);
      }),
    ).rejects.toMatchObject({ status: 429 });
    expect(write).not.toHaveBeenCalled();
    expect(await db.query.jobLeaseTable.findMany()).toEqual([]);
  });

  it("renews both leases while the operation is awaiting a provider", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await withLock("id", async () => {
      await db.execute(
        sql`UPDATE job_lease SET expires_at = timezone('UTC', clock_timestamp()) + interval '30 seconds'`,
      );
      await vi.advanceTimersByTimeAsync(REQUEST_LEASE_RENEWAL_MS);
      // Let the real database finish the renewal started by the fake timer.
      await vi.waitFor(async () => {
        const result =
          await db.execute(sql`SELECT count(*)::int AS count FROM job_lease
          WHERE expires_at > timezone('UTC', clock_timestamp()) + interval '10 minutes'`);
        expect(result.rows[0]?.count).toBe(2);
      });
    });
    expect(await db.query.jobLeaseTable.findMany()).toEqual([]);
    const connect = vi.spyOn(getDatabasePool(), "connect");
    await vi.advanceTimersByTimeAsync(REQUEST_LEASE_RENEWAL_MS * 2);
    expect(connect).not.toHaveBeenCalled();
  });

  it("treats renewal errors as terminal even if the database later recovers", async () => {
    await expect(
      withLock("id", async (lease) => {
        const connect = vi
          .spyOn(getDatabasePool(), "connect")
          .mockRejectedValueOnce(new Error("database unavailable"));
        try {
          await expect(lease.check()).rejects.toThrow("database unavailable");
        } finally {
          connect.mockRestore();
        }
        await lease.transaction(async () => {
          throw new Error("must not run");
        });
      }),
    ).rejects.toThrow("database unavailable");
    expect(await db.query.jobLeaseTable.findMany()).toEqual([]);
  });

  it("rolls back failed business writes and makes capacity available again", async () => {
    await expect(
      withLock("id", (lease) =>
        lease.transaction(async (tx) => {
          await tx.insert(schema.jobLeaseTable).values({
            name: "business-write",
            owner: "test",
            expiresAt: new Date(),
          });
          throw new Error("write failed");
        }),
      ),
    ).rejects.toThrow("write failed");
    expect(await db.query.jobLeaseTable.findMany()).toEqual([]);
    await expect(withLock("id", async () => "retry")).resolves.toBe("retry");
  });

  it("cleans up an acquisition committed by the server when its reply is lost", async () => {
    const pool = getDatabasePool();
    const client = await pool.connect();
    const originalQuery = client.query.bind(client);
    const query = vi.spyOn(client, "query").mockImplementation((...args) => {
      const text = typeof args[0] === "string" ? args[0] : args[0].text;
      const result = Reflect.apply(originalQuery, client, args);
      if (/^commit\b/i.test(text)) {
        return Promise.resolve(result).then(() => {
          throw new Error("commit reply lost");
        });
      }
      return result;
    });
    const connect = vi.spyOn(pool, "connect").mockResolvedValueOnce(client);
    const run = vi.fn(async () => "must not run");
    try {
      await expect(withLock("id", run)).rejects.toMatchObject({
        cause: { message: "commit reply lost" },
      });
      expect(run).not.toHaveBeenCalled();
    } finally {
      connect.mockRestore();
      query.mockRestore();
    }
    expect(await db.query.jobLeaseTable.findMany()).toEqual([]);
    await expect(withLock("id", async () => "retry")).resolves.toBe("retry");
  });

  it("preserves a completed result on cleanup failure and recovers expired capacity", async () => {
    const cleanup = vi
      .spyOn(getDatabasePool(), "query")
      .mockRejectedValueOnce(new Error("cleanup unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(withLock("id", async () => "done")).resolves.toBe("done");
      expect(log).toHaveBeenCalledWith("Failed to release request leases", {
        scope,
      });
    } finally {
      cleanup.mockRestore();
      log.mockRestore();
    }
    expect(await db.query.jobLeaseTable.findMany()).toHaveLength(2);
    await db.execute(
      sql`UPDATE job_lease SET expires_at = timezone('UTC', clock_timestamp()) - interval '1 second'`,
    );
    await expect(withLock("id", async () => "retry")).resolves.toBe("retry");
    expect(await db.query.jobLeaseTable.findMany()).toEqual([]);
  });
});

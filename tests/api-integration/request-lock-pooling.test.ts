import { beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { getDatabasePool } from "../../apps/api/src/database";
import { withGithubImportLock } from "../../apps/api/src/github-integration/import-lock";
import { withLabelDeletionLock } from "../../apps/api/src/label/deletion-lock";
import { ensureTestDatabaseMigrated } from "./helpers/database";

beforeAll(ensureTestDatabaseMigrated);

describe.each([
  ["label deletion", withLabelDeletionLock],
  ["GitHub import", withGithubImportLock],
] as const)("%s behind transaction pooling", (_name, withLock) => {
  it("releases all locks when autocommit statements change backend sessions", async () => {
    const pool = getDatabasePool();
    const frontend = await pool.connect();
    const backends = [await pool.connect(), await pool.connect()];
    const pids = await Promise.all(
      backends.map(async (client) =>
        Number(
          (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid,
        ),
      ),
    );
    let next = 0;
    let transactionBackend: (typeof backends)[number] | undefined;
    // Model transaction pooling with real PostgreSQL sessions: each standalone
    // statement moves, but BEGIN pins its backend until COMMIT or ROLLBACK.
    const query = vi.spyOn(frontend, "query").mockImplementation((...args) => {
      const text = typeof args[0] === "string" ? args[0] : args[0].text;
      const backend = transactionBackend ?? backends[next++ % backends.length];
      if (/^begin\b/i.test(text)) transactionBackend = backend;
      if (/^(commit|rollback)\b/i.test(text)) transactionBackend = undefined;
      return Reflect.apply(backend.query, backend, args);
    });
    const connect = vi.spyOn(pool, "connect").mockResolvedValueOnce(frontend);
    try {
      await expect(
        withLock("pooling-regression", async () => "done"),
      ).resolves.toBe("done");
      connect.mockRestore();
      query.mockRestore();
      const locks = await pool.query(
        "SELECT * FROM pg_locks WHERE locktype = 'advisory' AND pid = ANY($1::int[])",
        [pids],
      );
      expect(locks.rows).toEqual([]);
      await expect(
        withLock("pooling-regression", async () => "retried"),
      ).resolves.toBe("retried");
    } finally {
      connect.mockRestore();
      query.mockRestore();
      for (const backend of backends) {
        await backend.query("ROLLBACK");
        await backend.query("SELECT pg_advisory_unlock_all()");
        backend.release();
      }
    }
  });
});

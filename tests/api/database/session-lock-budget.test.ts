import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  releaseSessionLock,
  reserveSessionLock,
} from "../../../apps/api/src/database/session-lock-budget";
import {
  MAX_GITHUB_IMPORTS_IN_FLIGHT,
  withGithubImportLock,
} from "../../../apps/api/src/github-integration/import-lock";
import {
  MAX_LABEL_DELETIONS_IN_FLIGHT,
  withLabelDeletionLock,
} from "../../../apps/api/src/label/deletion-lock";

const pool = vi.hoisted(() => ({ options: { max: 10 }, connect: vi.fn() }));
vi.mock("../../../apps/api/src/database", () => ({
  getDatabasePool: () => pool,
}));

function client({ acquired = true, unlock = true } = {}) {
  return {
    query: vi.fn(async (text: string) => {
      if (!unlock && text.includes("unlock")) throw new Error("unlock failed");
      return { rows: [{ acquired }] };
    }),
    release: vi.fn(),
  };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const helpers = [
  ["label deletion", withLabelDeletionLock],
  ["GitHub import", withGithubImportLock],
] as const;

beforeEach(() => {
  pool.options.max = 10;
  pool.connect.mockReset().mockImplementation(async () => client());
});

describe("session lock budget", () => {
  it("leaves one pooled client free", () => {
    for (const max of [2, 10]) {
      pool.options.max = max;
      let held = 0;
      while (reserveSessionLock()) held++;
      expect(held).toBe(max - 1);
      for (; held > 0; held--) releaseSessionLock();
    }
  });

  it("admits both helpers' full caps with the default pool", async () => {
    const gate = deferred();
    const running = [
      ...Array.from({ length: MAX_LABEL_DELETIONS_IN_FLIGHT }, (_, i) =>
        withLabelDeletionLock(`label-${i}`, () => gate.promise),
      ),
      ...Array.from({ length: MAX_GITHUB_IMPORTS_IN_FLIGHT }, (_, i) =>
        withGithubImportLock(`import-${i}`, () => gate.promise),
      ),
    ];
    for (const [, withLock] of helpers)
      await expect(withLock("extra", async () => {})).rejects.toMatchObject({
        status: 429,
      });
    gate.resolve();
    await Promise.all(running);
    expect(pool.connect).toHaveBeenCalledTimes(running.length);
  });

  it("shares one budget between both helpers", async () => {
    pool.options.max = 3;
    const gate = deferred();
    const running = [
      withLabelDeletionLock("label", () => gate.promise),
      withGithubImportLock("import", () => gate.promise),
    ];
    for (const [, withLock] of helpers)
      await expect(withLock("extra", async () => {})).rejects.toMatchObject({
        status: 429,
      });
    expect(pool.connect).toHaveBeenCalledTimes(2);
    gate.resolve();
    await Promise.all(running);
    for (const [, withLock] of helpers)
      await expect(withLock("later", async () => "ok")).resolves.toBe("ok");
  });

  it.each(helpers)(
    "releases the %s reservation on every path",
    async (_, withLock) => {
      pool.options.max = 2;
      const budgetRestored = () => {
        expect(reserveSessionLock()).toBe(true);
        expect(reserveSessionLock()).toBe(false);
        releaseSessionLock();
      };

      pool.connect.mockRejectedValueOnce(new Error("connect failed"));
      await expect(withLock("id", async () => {})).rejects.toThrow(
        "connect failed",
      );
      budgetRestored();

      pool.connect.mockResolvedValueOnce(client({ acquired: false }));
      await expect(withLock("id", async () => {})).rejects.toMatchObject({
        status: 429,
      });
      budgetRestored();

      await expect(
        withLock("id", async () => {
          throw new Error("failed");
        }),
      ).rejects.toThrow("failed");
      budgetRestored();

      pool.connect.mockResolvedValueOnce(client({ unlock: false }));
      await expect(withLock("id", async () => "done")).resolves.toBe("done");
      budgetRestored();
    },
  );
});

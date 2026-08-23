import { describe, expect, it, vi } from "vitest";
import { withLeaderLock } from "../../apps/api/src/scheduler/leader-lock";

const TEST_LOCK = 990125;

describe("withLeaderLock", () => {
  it("lets a second caller skip while the first still holds the lock", async () => {
    let firstHasLock = false;
    let secondRan = false;
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = withLeaderLock(
      TEST_LOCK,
      async () => {
        firstHasLock = true;
        await held;
        return "ran";
      },
      () => "skipped",
    );

    try {
      await vi.waitFor(() => {
        expect(firstHasLock).toBe(true);
      });

      const second = await withLeaderLock(
        TEST_LOCK,
        async () => {
          secondRan = true;
          return "ran";
        },
        () => "skipped",
      );

      expect(second).toBe("skipped");
      expect(secondRan).toBe(false);
    } finally {
      release();
      await expect(first).resolves.toBe("ran");
    }
  });

  it("releases the lock so a later run can take it", async () => {
    const first = await withLeaderLock(
      TEST_LOCK,
      async () => "ran",
      () => "skipped",
    );
    const second = await withLeaderLock(
      TEST_LOCK,
      async () => "ran",
      () => "skipped",
    );

    expect(first).toBe("ran");
    expect(second).toBe("ran");
  });

  it("releases the lock when the job throws", async () => {
    await expect(
      withLeaderLock(
        TEST_LOCK,
        async () => {
          throw new Error("job blew up");
        },
        () => "skipped",
      ),
    ).rejects.toThrow("job blew up");

    const after = await withLeaderLock(
      TEST_LOCK,
      async () => "ran",
      () => "skipped",
    );
    expect(after).toBe("ran");
  });

  it("does not block a different lock key", async () => {
    let holderHasLock = false;
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    const holder = withLeaderLock(
      TEST_LOCK,
      async () => {
        holderHasLock = true;
        await held;
        return "ran";
      },
      () => "skipped",
    );

    try {
      await vi.waitFor(() => {
        expect(holderHasLock).toBe(true);
      });

      const other = await withLeaderLock(
        TEST_LOCK + 1,
        async () => "ran",
        () => "skipped",
      );

      expect(other).toBe("ran");
    } finally {
      release();
      await holder;
    }
  });
});

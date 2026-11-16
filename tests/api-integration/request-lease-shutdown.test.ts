import { expect, it, vi } from "vite-plus/test";
import db from "../../apps/api/src/database";
import { stopActiveRequestLeases } from "../../apps/api/src/database/with-request-lease";
import { withGithubImportLock } from "../../apps/api/src/github-integration/import-lock";
import { withLabelDeletionLock } from "../../apps/api/src/label/deletion-lock";
import { resetTestDatabase } from "./helpers/database";

it("releases request leases during shutdown and fences late provider completions", async () => {
  await resetTestDatabase();
  let finishProvider!: () => void;
  const provider = new Promise<void>((resolve) => {
    finishProvider = resolve;
  });
  const write = vi.fn(async () => {});
  let entered = 0;
  const running = [withLabelDeletionLock, withGithubImportLock].map(
    (withLock) =>
      expect(
        withLock("shutdown", async (lease) => {
          entered++;
          await provider;
          await lease.transaction(write);
        }),
      ).rejects.toMatchObject({ status: 429 }),
  );
  try {
    await vi.waitFor(() => expect(entered).toBe(2));
    expect(await db.query.jobLeaseTable.findMany()).toHaveLength(4);
    expect(await stopActiveRequestLeases()).toBe(true);
    expect(await db.query.jobLeaseTable.findMany()).toEqual([]);
    await expect(withLabelDeletionLock("new", write)).rejects.toMatchObject({
      status: 429,
    });
  } finally {
    finishProvider();
    await Promise.all(running);
  }
  expect(write).not.toHaveBeenCalled();
  expect(await db.query.jobLeaseTable.findMany()).toEqual([]);
});

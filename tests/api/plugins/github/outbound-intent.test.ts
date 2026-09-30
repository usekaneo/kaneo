import { beforeEach, expect, it, vi } from "vite-plus/test";
import { syncLatestTaskValue } from "../../../../apps/api/src/plugins/github/services/sync-latest-task-value";
import { inboundEcho } from "../../../../apps/api/src/plugins/github/utils/inbound-echo";
import { mergeSyncMetadata } from "../../../../apps/api/src/plugins/github/utils/merge-sync-metadata";
import {
  isPendingOutboundEcho,
  outboundStamp,
  type OutboundIntent,
  type SyncStamp,
} from "../../../../apps/api/src/plugins/github/utils/sync-echo";
const m = vi.hoisted(() => ({
  current: { title: "", description: "", status: "" },
  stamps: {} as Record<string, SyncStamp>,
  save: vi.fn(),
}));
vi.mock("../../../../apps/api/src/database", () => ({
  default: { query: { taskTable: { findFirst: async () => m.current } } },
}));
vi.mock(
  "../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({
    findExternalLinksByTask: async () => [
      { id: "link", integrationId: "integration", resourceType: "issue" },
    ],
    updateExternalLink: m.save,
  }),
);
const link = { id: "link", integrationId: "integration" };
beforeEach(() => {
  m.stamps = {};
  m.save.mockReset().mockImplementation(
    async (
      _id: string,
      {
        outbound,
      }: {
        outbound: OutboundIntent & {
          field: string;
          value: string;
          updatedAt?: string;
        };
      },
    ) => {
      m.stamps[outbound.field] = outboundStamp(
        m.stamps[outbound.field],
        outbound.value,
        outbound.updatedAt,
        outbound,
      );
    },
  );
});
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
it.each(["title", "description", "state"] as const)(
  "preserves the newest %s when an old webhook arrives before its PATCH response",
  async (field) => {
    const a = field === "state" ? "closed" : "A";
    const b = field === "state" ? "open" : "B";
    m.current = { title: a, description: a, status: "done" };
    const started = deferred();
    const release = deferred();
    let first = true;
    let remote = a;
    const write = async (value: string) => {
      if (first) {
        first = false;
        started.resolve();
        await release.promise;
      }
      remote = value;
      // Exercise the same predicate used by the guarded inbound handlers while
      // the provider has applied the write and has not returned its response.
      if (!inboundEcho(m.stamps[field], value, `${value}-stamp`, remote)) {
        if (field === "state")
          m.current.status = value === "closed" ? "done" : "to-do";
        else m.current[field] = value;
      }
      return `${value}-stamp`;
    };
    const older = syncLatestTaskValue("task", "project", link, field, a, write);
    await started.promise;
    m.current = { title: b, description: b, status: "to-do" };
    await syncLatestTaskValue("task", "project", link, field, b, write);
    release.resolve();
    await older;
    expect(remote).toBe(b);
    expect(field === "state" ? m.current.status : m.current[field]).toBe(
      field === "state" ? "to-do" : b,
    );
    expect(m.stamps[field].outbound?.some((entry) => entry.pending)).toBe(
      false,
    );
    expect(inboundEcho(m.stamps[field], a, "legitimate-later-stamp", a)).toBe(
      false,
    );
  },
);
it("clears failed intents so a later legitimate provider edit is accepted", async () => {
  await expect(
    syncLatestTaskValue("task", "project", link, "title", "A", async () => {
      throw new Error("provider failed");
    }),
  ).rejects.toThrow("provider failed");
  expect(isPendingOutboundEcho(m.stamps.title, "A")).toBe(false);
  expect(inboundEcho(m.stamps.title, "A", "later", "A")).toBe(false);
});
it("does not resurrect a settled intent from stale metadata", () => {
  const pending = outboundStamp(undefined, "A", undefined, {
    intentId: "a",
    pending: true,
  });
  const completed = outboundStamp(pending, "A", "stamp", {
    intentId: "a",
    pending: false,
  });
  const merged = mergeSyncMetadata(
    { lastSync: { title: completed } },
    { lastSync: { title: pending } },
  );
  expect(merged.lastSync?.title.outbound).toHaveLength(1);
  expect(isPendingOutboundEcho(merged.lastSync?.title, "A")).toBe(false);
});
it("keeps an active intent while bounding completed rapid-write history", () => {
  let stamp = outboundStamp(undefined, "A", undefined, {
    intentId: "a",
    pending: true,
  });
  for (let index = 0; index < 50; index++)
    stamp = outboundStamp(stamp, `B${index}`, `stamp-${index}`, {
      intentId: `b${index}`,
      pending: false,
    });
  expect(stamp.outbound?.filter((entry) => !entry.pending)).toHaveLength(32);
  expect(isPendingOutboundEcho(stamp, "A")).toBe(true);
});

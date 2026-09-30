import { beforeEach, expect, it, vi } from "vite-plus/test";
import { syncLatestTaskValue } from "../../../../apps/api/src/plugins/github/services/sync-latest-task-value";
import {
  inboundEcho,
  withEchoConfirmation,
} from "../../../../apps/api/src/plugins/github/utils/inbound-echo";
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
      {
        id: "link",
        integrationId: "integration",
        resourceType: "issue",
        metadata: JSON.stringify({ lastSync: m.stamps }),
      },
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
        observedOutbound,
      }: {
        observedOutbound?: {
          field: string;
          intentId: string;
          updatedAt: string;
        };
        outbound?: OutboundIntent & {
          field: string;
          value: string;
          updatedAt?: string;
        };
      },
    ) => {
      if (observedOutbound) {
        const entry = m.stamps[observedOutbound.field]?.outbound?.find(
          (entry) => entry.intentId === observedOutbound.intentId,
        );
        if (
          entry &&
          (!entry.observedUpdatedAt ||
            observedOutbound.updatedAt > entry.observedUpdatedAt)
        )
          entry.observedUpdatedAt = observedOutbound.updatedAt;
      }
      if (!outbound) return;
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
    const webhooks: Promise<unknown>[] = [];
    const write = async (value: string) => {
      if (first) {
        first = false;
        started.resolve();
        await release.promise;
      }
      remote = value;
      // The provider does not wait for webhook processing before responding.
      webhooks.push(
        withEchoConfirmation(
          async () => remote,
          (current) => {
            if (
              !inboundEcho(m.stamps[field], value, `${value}-stamp`, current, {
                linkId: "link",
                field,
              })
            ) {
              if (field === "state")
                m.current.status = value === "closed" ? "done" : "to-do";
              else m.current[field] = value;
            }
            return Promise.resolve();
          },
        ),
      );
      return `${value}-stamp`;
    };
    const older = syncLatestTaskValue("task", "project", link, field, a, write);
    await started.promise;
    m.current = { title: b, description: b, status: "to-do" };
    await syncLatestTaskValue("task", "project", link, field, b, write);
    release.resolve();
    await older;
    await Promise.all(webhooks);
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
      throw Object.assign(new Error("provider failed"), { status: 422 });
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

it.each(["title", "description", "state"] as const)(
  "preserves a later provider %s edit back to an in-flight value",
  async (field) => {
    const a = field === "state" ? "closed" : "A";
    const b = field === "state" ? "open" : "B";
    m.current = { title: a, description: a, status: "done" };
    const started = deferred();
    const release = deferred();
    let remote = a;
    const firstVersion = "2026-09-30T00:00:01Z";
    const laterVersion = "2026-09-30T00:00:03Z";
    const outbound = syncLatestTaskValue(
      "task",
      "project",
      link,
      field,
      a,
      async (value) => {
        remote = value;
        started.resolve();
        await release.promise;
        return firstVersion;
      },
    );
    await started.promise;
    const apply = (value: string, version: string) =>
      withEchoConfirmation(
        async () => remote,
        (current) => {
          if (
            !inboundEcho(m.stamps[field], value, version, current, {
              linkId: "link",
              field,
            })
          ) {
            if (field === "state")
              m.current.status = value === "closed" ? "done" : "to-do";
            else m.current[field] = value;
          }
          return Promise.resolve();
        },
      );
    const original = apply(a, firstVersion);
    remote = b;
    await apply(b, "2026-09-30T00:00:02Z");
    remote = a;
    const legitimate = apply(a, laterVersion);
    await vi.waitFor(() =>
      expect(m.stamps[field].outbound?.[0].observedUpdatedAt).toBe(
        laterVersion,
      ),
    );
    release.resolve();
    await Promise.all([outbound, original, legitimate]);
    expect(remote).toBe(a);
    expect(field === "state" ? m.current.status : m.current[field]).toBe(
      field === "state" ? "done" : a,
    );
  },
);
it.each([
  new Error("lost response"),
  Object.assign(new Error("timeout"), { status: 408 }),
  Object.assign(new Error("gateway failure"), { status: 502 }),
])(
  "recognizes a potentially applied failed write after a newer local edit (%s)",
  async (error) => {
    m.current = { title: "A", description: "", status: "to-do" };
    let remote = "A";
    await expect(
      syncLatestTaskValue("task", "project", link, "title", "A", async () => {
        throw error;
      }),
    ).rejects.toThrow(error.message);
    m.current.title = "B";
    await syncLatestTaskValue(
      "task",
      "project",
      link,
      "title",
      "B",
      async (value) => {
        remote = value;
        return "2026-09-30T00:00:02Z";
      },
    );
    const echo = await withEchoConfirmation(
      async () => remote,
      (current) =>
        Promise.resolve(
          inboundEcho(m.stamps.title, "A", "2026-09-30T00:00:01Z", current),
        ),
    );
    expect(echo).toBe(true);
    expect(m.current.title).toBe("B");
    expect(inboundEcho(m.stamps.title, "A", "2026-09-30T00:00:03Z", "A")).toBe(
      false,
    );
  },
);

import { beforeEach, expect, it, vi } from "vite-plus/test";
import { syncLatestTaskValue } from "../../../../apps/api/src/plugins/github/services/sync-latest-task-value";
import {
  inboundEcho,
  withEchoConfirmation,
} from "../../../../apps/api/src/plugins/github/utils/inbound-echo";
import { mergeSyncMetadata } from "../../../../apps/api/src/plugins/github/utils/merge-sync-metadata";
import {
  inboundStamp,
  inboundOccurredAfterIntent,
  isPendingOutboundEcho,
  outboundStamp,
  type OutboundIntent,
  type SyncStamp,
} from "../../../../apps/api/src/plugins/github/utils/sync-echo";
const m = vi.hoisted(() => ({
  current: { title: "", description: "", status: "" },
  stamps: {} as Record<string, SyncStamp>,
  save: vi.fn(),
  dispatch: vi.fn(),
}));
vi.mock("../../../../apps/api/src/database", () => ({
  default: {
    query: {
      taskTable: { findFirst: async () => m.current },
      columnTable: { findFirst: async () => undefined },
    },
  },
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
        integration: {
          id: "integration",
          projectId: "project",
          type: "github",
        },
      },
    ],
    updateExternalLink: m.save,
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/github/services/apply-observed-task-value",
  () => ({
    applyObservedTaskValue: async (
      _link: unknown,
      _integration: unknown,
      field: "title" | "description" | "state",
      value: string,
      _intentId: string,
      _updatedAt: string | undefined,
      expectedRevision: string,
    ) => {
      if (JSON.stringify(m.current) !== expectedRevision) return false;
      if (field === "state")
        m.current.status = value === "closed" ? "done" : "to-do";
      else m.current[field] = value;
      m.stamps[field] = inboundStamp(m.stamps[field], value, "github");
      return true;
    },
  }),
);
vi.mock(
  "../../../../apps/api/src/plugins/github/services/integration-task-scope",
  async (original) => ({
    ...(await original<
      typeof import("../../../../apps/api/src/plugins/github/services/integration-task-scope")
    >()),
    integrationTaskRevision: async () => JSON.stringify(m.current),
  }),
);
const link = { id: "link", integrationId: "integration" };
beforeEach(() => {
  m.dispatch
    .mockReset()
    .mockImplementation(
      async (
        _link: unknown,
        _config: unknown,
        send: () => Promise<unknown>,
      ) => ({ value: await send() }),
    );
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

it.each(
  (["title", "description", "state"] as const).flatMap((field) =>
    [false, true].map((colliding) => ({ field, colliding })),
  ),
)(
  "preserves a later provider $field edit back to an in-flight value (collision=$colliding)",
  async ({ field, colliding }) => {
    const a = field === "state" ? "closed" : "A";
    const b = field === "state" ? "open" : "B";
    m.current = { title: a, description: a, status: "done" };
    const started = deferred();
    const release = deferred();
    let remote = a;
    const firstVersion = "2026-09-30T00:00:01Z";
    const laterVersion = colliding ? firstVersion : "2026-09-30T00:00:03Z";
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
      async () => remote,
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
            m.stamps[field] = inboundStamp(m.stamps[field], value, "github");
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
    const defer = vi.fn(async () => undefined);
    await withEchoConfirmation(
      async () => "A",
      async (current) =>
        inboundEcho(m.stamps.title, "A", "2026-09-30T00:00:03Z", current),
      defer,
    );
    expect(defer).toHaveBeenCalledOnce();
    expect(m.current.title).toBe("B");
  },
);

it("bounds abandoned intent polling and reports an unacknowledged delivery", async () => {
  vi.useFakeTimers();
  m.stamps.title = outboundStamp(undefined, "A", undefined, {
    intentId: "abandoned",
    pending: true,
  });
  let attempts = 0;
  const run = withEchoConfirmation(
    async () => "A",
    async () => {
      attempts++;
      return inboundEcho(m.stamps.title, "A", "version");
    },
  );
  const rejected = expect(run).rejects.toThrow("retry this webhook delivery");
  await vi.advanceTimersByTimeAsync(5000);
  await rejected;
  expect(attempts).toBeLessThanOrEqual(11);
  vi.useRealTimers();
});

it.each([false, true])(
  "acknowledges an abandoned writer only after durable deferral (persistFailure=%s)",
  async (persistFailure) => {
    vi.useFakeTimers();
    m.stamps.title = outboundStamp(undefined, "A", undefined, {
      intentId: "orphan",
      pending: true,
    });
    const defer = vi.fn(async () => {
      if (persistFailure) throw new Error("database unavailable");
    });
    const run = withEchoConfirmation(
      async () => "A",
      async () => inboundEcho(m.stamps.title, "A", "version"),
      defer,
    );
    const result = persistFailure
      ? expect(run).rejects.toThrow(
          "Could not persist deferred webhook delivery",
        )
      : expect(run).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(5000);
    await result;
    expect(defer).toHaveBeenCalledOnce();
    vi.useRealTimers();
  },
);

it("does not PATCH when the link disappears before its pending intent commits", async () => {
  m.current.title = "B";
  m.save.mockResolvedValueOnce(false);
  const write = vi.fn(async () => "stamp");
  await syncLatestTaskValue("task", "project", link, "title", "B", write);
  expect(write).not.toHaveBeenCalled();
});

it("confirms a delayed different value sharing an outbound provider version", async () => {
  const stamp = outboundStamp(undefined, "A", "shared-version", {
    intentId: "completed",
  });
  expect(inboundEcho(stamp, "A", "shared-version")).toBe(true);
  const read = vi.fn(async () => "A");
  expect(
    await withEchoConfirmation(read, async (current) =>
      inboundEcho(stamp, "B", "shared-version", current),
    ),
  ).toBe(true);
  expect(read).toHaveBeenCalledOnce();
  expect(inboundEcho(stamp, "B", "shared-version", "B")).toBe(false);
});
it("durably defers a colliding event when provider confirmation fails", async () => {
  const stamp = outboundStamp(undefined, "A", "shared-version");
  const defer = vi.fn(async () => undefined);
  await withEchoConfirmation(
    async () => {
      throw new Error("provider unavailable");
    },
    async (current) => inboundEcho(stamp, "B", "shared-version", current),
    defer,
  );
  expect(defer).toHaveBeenCalledOnce();
});

it("distinguishes earlier and intervening inbound edits within one millisecond", () => {
  vi.useFakeTimers();
  const prior = inboundStamp(undefined, "B", "github");
  const pending = outboundStamp(prior, "A", undefined, {
    intentId: "pending",
    pending: true,
  });
  const intent = pending.outbound?.find(
    (entry) => entry.intentId === "pending",
  );
  expect(prior.inboundAt).toBe(intent?.startedAt);
  expect(inboundOccurredAfterIntent(prior, intent)).toBe(false);
  const later = inboundStamp(pending, "B", "github");
  expect(later.inboundAt).toBe(intent?.startedAt);
  expect(inboundOccurredAfterIntent(later, intent)).toBe(true);
  vi.useRealTimers();
});

it("confirms different inbound values sharing a provider version", async () => {
  const version = "2026-09-30T00:00:03Z";
  const stamp = inboundStamp(undefined, "B", "github", version);
  expect(inboundEcho(stamp, "A", "2026-09-30T00:00:02Z")).toBe(true);
  const read = vi.fn(async () => "B");
  expect(
    await withEchoConfirmation(read, async (current) =>
      inboundEcho(stamp, "A", version, current),
    ),
  ).toBe(true);
  expect(read).toHaveBeenCalledOnce();
  expect(inboundEcho(stamp, "A", version, "A")).toBe(false);
});

it("rereads a provider confirmation after the locked sync state changes", async () => {
  const version = "2026-09-30T00:00:03Z";
  let stamp = inboundStamp(undefined, "C", "github", version);
  const read = vi.fn(async () => {
    if (read.mock.calls.length === 1) {
      stamp = inboundStamp(stamp, "C", "github", version);
      return "B";
    }
    return "C";
  });
  const result = await withEchoConfirmation(
    read,
    async (current, confirmation) =>
      inboundEcho(stamp, "B", version, current, {
        linkId: "link",
        field: "title",
        localValue: stamp.value,
        confirmation,
      }),
  );
  expect(result).toBe(true);
  expect(read).toHaveBeenCalledTimes(2);
});
it("bounds confirmation retries and durably defers continuous sync changes", async () => {
  vi.useFakeTimers();
  try {
    const version = "2026-09-30T00:00:03Z";
    let stamp = inboundStamp(undefined, "C", "github", version);
    const read = vi.fn(async () => {
      stamp = inboundStamp(stamp, "C", "github", version);
      return "B";
    });
    const defer = vi.fn(async () => undefined);
    const run = withEchoConfirmation(
      read,
      async (current, confirmation) =>
        inboundEcho(stamp, "B", version, current, {
          linkId: "link",
          field: "title",
          localValue: stamp.value,
          confirmation,
        }),
      defer,
    );
    await vi.advanceTimersByTimeAsync(5000);
    await run;
    expect(defer).toHaveBeenCalledOnce();
    expect(read.mock.calls.length).toBeLessThanOrEqual(11);
  } finally {
    vi.useRealTimers();
  }
});

// Policy enforcement is covered by the PostgreSQL sync-rules integration tests.
vi.mock("../../../../apps/api/src/plugins/sync/eligibility", () => ({
  canSyncTask: async () => true,
}));

vi.mock("../../../../apps/api/src/plugins/sync/dispatch-issue-write", () => ({
  createIssueWrite: () => (send: () => Promise<unknown>) => send(),
  dispatchIssueWrite: m.dispatch,
}));

it("cancels an outbound intent when scope changes before dispatch", async () => {
  m.current = { title: "Paused edit", description: "", status: "to-do" };
  m.dispatch.mockResolvedValueOnce(undefined);
  const write = vi.fn();
  await syncLatestTaskValue(
    "task",
    "project",
    { id: "link", integrationId: "integration" },
    "title",
    "Paused edit",
    write,
  );
  expect(write).not.toHaveBeenCalled();
  expect(m.stamps.title?.outbound?.[0]).toMatchObject({
    pending: false,
    cancelled: true,
    uncertain: false,
  });
});

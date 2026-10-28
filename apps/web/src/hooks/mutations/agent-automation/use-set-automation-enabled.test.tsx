import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import setAutomationEnabled from "@/fetchers/agent-automation/set-automation-enabled";
import { automationQueryKeys as keys } from "@/hooks/queries/agent-automation/automation-query-keys";
import type { Automation, AutomationList } from "@/types/agent-automation";
import useSetAutomationEnabled from "./use-set-automation-enabled";

vi.mock("@/fetchers/agent-automation/set-automation-enabled", () => ({
  default: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const detail = {
    id: "a",
    enabled: true,
    pausedReason: "failures",
    consecutiveFailures: 3,
    lastSkipReason: null,
  } as Automation;
  const list = {
    items: [
      { ...detail, kind: "agent" },
      { id: "other", kind: "agent", enabled: true },
      { id: "rule", kind: "rule" },
    ],
    total: 3,
    counts: { agent: 2, rules: 1, all: 3 },
  } as AutomationList;
  client.setQueryData(keys.detail("w", "a"), detail);
  client.setQueryData(keys.list("w"), list);
  client.setQueryData(keys.list("w", { kind: "agent" }), list);
  client.setQueryData(keys.detail("other-workspace", "a"), detail);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    detail,
    list,
    ...renderHook(() => useSetAutomationEnabled("w", "a"), { wrapper }),
  };
}

describe("useSetAutomationEnabled", () => {
  it.each([true, false])(
    "optimistically sets %s in detail and filtered lists, then invalidates",
    async (enabled) => {
      let resolve!: (value: Automation) => void;
      vi.mocked(setAutomationEnabled).mockReturnValue(
        new Promise((done) => {
          resolve = done;
        }),
      );
      const ctx = setup();
      let mutation!: Promise<Automation>;
      act(() => {
        mutation = ctx.result.current.mutateAsync(enabled);
      });
      await waitFor(() =>
        expect(
          ctx.client.getQueryData<Automation>(keys.detail("w", "a"))?.enabled,
        ).toBe(enabled),
      );
      expect(
        ctx.client.getQueryData<Automation>(keys.detail("w", "a"))
          ?.pausedReason,
      ).toBeNull();
      for (const [, data] of ctx.client.getQueriesData<AutomationList>({
        queryKey: keys.lists("w"),
      })) {
        expect(data?.items[0]).toMatchObject({ enabled, pausedReason: null });
        expect(data?.items[2]).toEqual({ id: "rule", kind: "rule" });
      }
      expect(
        ctx.client.getQueryData(keys.detail("other-workspace", "a")),
      ).toEqual(ctx.detail);
      await act(async () => {
        resolve({ ...ctx.detail, enabled });
        await mutation;
      });
      expect(setAutomationEnabled).toHaveBeenCalledWith("w", "a", enabled);
      expect(
        ctx.client.getQueryState(keys.detail("w", "a"))?.isInvalidated,
      ).toBe(true);
    },
  );

  it("rolls back on failure without reverting concurrent changes to another automation", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(setAutomationEnabled).mockReturnValue(
      new Promise((_done, fail) => {
        reject = fail;
      }),
    );
    const ctx = setup();
    let mutation!: Promise<unknown>;
    act(() => {
      mutation = ctx.result.current
        .mutateAsync(false)
        .catch((error: unknown) => error);
    });
    await waitFor(() =>
      expect(
        ctx.client.getQueryData<Automation>(keys.detail("w", "a"))?.enabled,
      ).toBe(false),
    );
    ctx.client.setQueryData<AutomationList>(keys.list("w"), (data) =>
      data
        ? {
            ...data,
            items: data.items.map((item) =>
              item.id === "other" && item.kind === "agent"
                ? { ...item, enabled: false }
                : item,
            ),
          }
        : data,
    );
    await act(async () => {
      reject(new Error("Denied"));
      await mutation;
    });
    expect(ctx.client.getQueryData(keys.detail("w", "a"))).toEqual(ctx.detail);
    const items = ctx.client.getQueryData<AutomationList>(
      keys.list("w"),
    )!.items;
    expect(items[0]).toEqual(ctx.list.items[0]);
    expect(items[1]).toMatchObject({ id: "other", enabled: false });
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import getAgentRun from "@/fetchers/agent/get-agent-run";
import type { AgentRun } from "@/types/agent";
import useAgentRun from "./use-agent-run";

vi.mock("@/fetchers/agent/get-agent-run", () => ({ default: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

it.each([true, false])(
  "keeps terminal run polling appropriate for shared viewer=%s",
  async (watch) => {
    const before = {
      id: "run",
      status: "awaiting_review",
      proposals: [{ id: "proposal", status: "pending" }],
      jobs: [],
    } as unknown as AgentRun;
    const after = {
      ...before,
      status: "completed",
      proposals: [{ id: "proposal", status: "applied" }],
    } as unknown as AgentRun;
    vi.mocked(getAgentRun)
      .mockResolvedValueOnce(before)
      .mockResolvedValue(after);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(
      ({ watch }) => {
        const { data, isSuccess } = useAgentRun("workspace", "run", watch);
        return { data, isSuccess };
      },
      { wrapper, initialProps: { watch: false } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    vi.useFakeTimers();
    rerender({ watch });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_001);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(getAgentRun).toHaveBeenCalledTimes(watch ? 2 : 1);
    expect(result.current.data?.proposals[0]?.status).toBe(
      watch ? "applied" : "pending",
    );
    client.clear();
  },
);

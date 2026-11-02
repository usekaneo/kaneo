import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import getAgentConversationRuns from "@/fetchers/agent/get-agent-conversation-runs";
import type { AgentRunSummary } from "@/types/agent";
import useAgentConversationRuns from "./use-agent-conversation-runs";

vi.mock("@/fetchers/agent/get-agent-conversation-runs", () => ({
  default: vi.fn(),
}));
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

const run = (id: number) =>
  ({ id: String(id), prompt: `Turn ${id}` }) as AgentRunSummary;

function setup(conversationId: string | undefined) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    () => useAgentConversationRuns("workspace", conversationId),
    { wrapper },
  );
}

describe("useAgentConversationRuns", () => {
  it("loads older turns and retains the latest run at the bottom", async () => {
    vi.mocked(getAgentConversationRuns)
      .mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => run(11 - i)))
      .mockResolvedValueOnce([run(1)]);
    const { result } = setup("conversation");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((item) => item.id)).toEqual([
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
    ]);
    expect(result.current.hasNextPage).toBe(true);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data).toHaveLength(11));
    expect(getAgentConversationRuns).toHaveBeenLastCalledWith(
      "workspace",
      "conversation",
      10,
    );
    expect(result.current.data?.map((item) => item.id)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
    ]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("does not duplicate turns when a new run shifts an offset boundary", async () => {
    vi.mocked(getAgentConversationRuns)
      .mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => run(11 - i)))
      .mockResolvedValueOnce([run(2), run(1)]);
    const { result } = setup("conversation");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(getAgentConversationRuns).toHaveBeenLastCalledWith(
      "workspace",
      "conversation",
      10,
    );
    await waitFor(() => expect(result.current.data).toHaveLength(11));
    expect(result.current.data?.filter((item) => item.id === "2")).toHaveLength(
      1,
    );
    expect(result.current.data?.at(-1)?.id).toBe("11");
  });

  it("does not request history before a conversation exists", () => {
    setup(undefined);
    expect(getAgentConversationRuns).not.toHaveBeenCalled();
  });
});

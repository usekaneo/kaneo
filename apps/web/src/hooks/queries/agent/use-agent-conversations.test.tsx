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
import getAgentConversations from "@/fetchers/agent/get-agent-conversations";
import type { AgentConversation } from "@/types/agent";
import useAgentConversations from "./use-agent-conversations";

vi.mock("@/fetchers/agent/get-agent-conversations", () => ({
  default: vi.fn(),
}));
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
const conversation = (id: number, title = `Conversation ${id}`) =>
  ({ id: String(id), title }) as AgentConversation;
function setup(projectId = "project") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useAgentConversations("workspace", projectId, true), {
    wrapper,
  });
}

describe("useAgentConversations", () => {
  it("loads older conversations while retaining project scope and newer data at overlapping boundaries", async () => {
    vi.mocked(getAgentConversations)
      .mockResolvedValueOnce(
        Array.from({ length: 20 }, (_, i) => conversation(21 - i)),
      )
      .mockResolvedValueOnce([
        conversation(2, "Older stale title"),
        conversation(1),
      ]);
    const { result } = setup();
    await waitFor(() =>
      expect(result.current.isSuccess && !result.current.isFetching).toBe(true),
    );
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data).toHaveLength(21));
    expect(getAgentConversations).toHaveBeenLastCalledWith(
      "workspace",
      "project",
      20,
    );
    expect(result.current.data?.find((item) => item.id === "2")?.title).toBe(
      "Conversation 2",
    );
    expect(result.current.data?.at(-1)?.id).toBe("1");
    expect(result.current.hasNextPage).toBe(false);
  });

  it("keeps the loaded page available when an older page fails", async () => {
    vi.mocked(getAgentConversations)
      .mockResolvedValueOnce(
        Array.from({ length: 20 }, (_, i) => conversation(20 - i)),
      )
      .mockRejectedValueOnce(new Error("Page failed"));
    const { result } = setup();
    await waitFor(() =>
      expect(result.current.isSuccess && !result.current.isFetching).toBe(true),
    );
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toHaveLength(20);
    expect(result.current.hasNextPage).toBe(true);
  });
});

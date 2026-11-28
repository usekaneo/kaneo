import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { useGetWorkspaceBoard } from "./use-get-workspace-board";

const { getWorkspaceBoard } = vi.hoisted(() => ({
  getWorkspaceBoard: vi.fn(),
}));
vi.mock("@/fetchers/task/get-workspace-board", () => ({
  default: getWorkspaceBoard,
}));

afterEach(() => getWorkspaceBoard.mockReset());

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

it("reports partial pages only on the first load", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  getWorkspaceBoard.mockResolvedValue({ id: "workspace-board:w", columns: [] });
  const { result } = renderHook(
    () => useGetWorkspaceBoard("w", { includeCompleted: "false" }),
    { wrapper: wrapper(client) },
  );
  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(getWorkspaceBoard.mock.calls[0][3]).toBeTypeOf("function");

  await act(() => result.current.refetch());
  expect(getWorkspaceBoard).toHaveBeenCalledTimes(2);
  expect(getWorkspaceBoard.mock.calls[1][3]).toBeUndefined();
});

it("waits while disabled", async () => {
  const client = new QueryClient();
  renderHook(
    () =>
      useGetWorkspaceBoard(
        "w",
        { includeCompleted: "false" },
        { enabled: false },
      ),
    { wrapper: wrapper(client) },
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(getWorkspaceBoard).not.toHaveBeenCalled();
});

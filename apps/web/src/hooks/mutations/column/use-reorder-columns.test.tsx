import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import reorderColumns from "@/fetchers/column/reorder-columns";
import { useReorderColumns } from "./use-reorder-columns";

vi.mock("@/fetchers/column/reorder-columns", () => ({ default: vi.fn() }));
afterEach(cleanup);

it("refreshes the affected columns after a failed save and waits for recovery", async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  let finishRefresh!: () => void;
  const invalidate = vi.spyOn(client, "invalidateQueries").mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finishRefresh = resolve;
      }),
  );
  const error = new Error("Reorder failed");
  vi.mocked(reorderColumns).mockRejectedValue(error);
  const { result } = renderHook(useReorderColumns, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  let settled = false;
  let pending!: Promise<unknown>;
  await act(async () => {
    pending = result.current
      .mutateAsync({
        projectId: "project",
        columns: [{ id: "A", position: 0 }],
      })
      .catch((caught: unknown) => {
        settled = true;
        return caught;
      });
  });
  expect(invalidate).toHaveBeenCalledExactlyOnceWith({
    queryKey: ["columns", "project"],
  });
  expect(settled).toBe(false);
  await act(async () => {
    finishRefresh();
    expect(await pending).toBe(error);
  });
  expect(settled).toBe(true);
  client.clear();
});

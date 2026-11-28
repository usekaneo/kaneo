import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vite-plus/test";
import useExternalLinks from "./use-external-links";

const getLinks = vi.hoisted(() => vi.fn());

vi.mock("@/fetchers/external-link/get-external-links", () => ({
  default: getLinks,
}));

it("refetches cached links when a task view mounts again", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnMount: false } },
  });
  client.setQueryData(["external-links", "task-1"], []);
  getLinks.mockResolvedValue([{ id: "link-1" }]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(() => useExternalLinks("task-1"), { wrapper });

  await waitFor(() => expect(result.current.data).toEqual([{ id: "link-1" }]));
  expect(getLinks).toHaveBeenCalledWith("task-1");
});

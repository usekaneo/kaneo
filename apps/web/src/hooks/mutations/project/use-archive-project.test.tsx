import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vite-plus/test";
import archiveProject from "@/fetchers/project/archive-project";
import useArchiveProject from "./use-archive-project";

vi.mock("@/fetchers/project/archive-project", () => ({ default: vi.fn() }));

it("invalidates both assigned work queries in the archived project's workspace", async () => {
  vi.mocked(archiveProject).mockImplementation(async () =>
    Object.assign({} as Awaited<ReturnType<typeof archiveProject>>, {
      workspaceId: "workspace",
    }),
  );
  const client = new QueryClient();
  const keys = [
    ["assigned-tasks", "workspace", { countOnly: false }],
    ["assigned-tasks", "workspace", { countOnly: true }],
    ["assigned-tasks", "other-workspace", { countOnly: true }],
  ];
  for (const key of keys) client.setQueryData(key, []);
  const { result, unmount } = renderHook(useArchiveProject, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });

  await act(() => result.current.mutateAsync({ id: "project" }));
  expect(keys.map((key) => client.getQueryState(key)?.isInvalidated)).toEqual([
    true,
    true,
    false,
  ]);
  unmount();
  client.clear();
});

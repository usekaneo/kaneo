import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { useCollapsedSections } from "@/hooks/use-collapsed-sections";
import { useCreateColumn } from "./use-create-column";

vi.mock("@/fetchers/column/create-column", () => ({
  default: vi.fn(async (projectId: string, data: { name: string }) => ({
    id: "column-new",
    projectId,
    name: data.name,
    slug: data.name.toLowerCase(),
  })),
}));

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

afterEach(() => window.localStorage.clear());

it("starts a re-created column expanded after the old one was collapsed", async () => {
  const before = renderHook(() => useCollapsedSections("p", "list"));
  act(() => before.result.current.toggleSection("qa"));
  act(() => before.result.current.toggleSection("done"));
  // The old "QA" column is deleted in project settings, where the list view
  // is not mounted, so only the create mutation sees the slug come back.
  before.unmount();

  const create = renderHook(() => useCreateColumn(), { wrapper: Providers });
  await act(() =>
    create.result.current.mutateAsync({
      projectId: "p",
      data: { name: "QA" },
    }),
  );

  const after = renderHook(() => useCollapsedSections("p", "list"));
  expect(after.result.current.isExpanded("qa")).toBe(true);
  expect(after.result.current.isExpanded("done")).toBe(false);
});

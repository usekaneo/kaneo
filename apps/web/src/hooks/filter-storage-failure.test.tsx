import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTaskFilters } from "./use-task-filters";
import { useTaskFiltersWithLabelsSupport } from "./use-task-filters-with-labels-support";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe.each([
  ["basic filters", useTaskFilters],
  ["label filters", useTaskFiltersWithLabelsSupport],
] as const)("%s with unavailable storage", (_name, useFilters) => {
  it.each(["SecurityError", "QuotaExceededError", "storage getter"])(
    "keeps in-memory filtering usable after %s",
    (failure) => {
      if (failure === "storage getter") {
        vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
          throw new DOMException("Storage blocked", "SecurityError");
        });
      } else {
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
          throw new DOMException("Storage unavailable", failure);
        });
      }
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const { result } = renderHook(() => useFilters(undefined, "project-a"), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      });
      act(() => result.current.updateFilter("priority", ["urgent"]));
      expect(result.current.filters.priority).toEqual(["urgent"]);
      expect(result.current.hasActiveFilters).toBe(true);
      act(() => result.current.clearFilters());
      expect(result.current.filters.priority).toBeNull();
      expect(result.current.hasActiveFilters).toBe(false);
    },
  );
});

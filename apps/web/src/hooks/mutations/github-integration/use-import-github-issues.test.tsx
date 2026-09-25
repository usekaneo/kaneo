import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import queryClient from "@/query-client";
import useImportGithubIssues from "./use-import-github-issues";

const { run } = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@/fetchers/github-integration/import-github-issues", () => ({
  default: run,
}));
afterEach(() => {
  cleanup();
  queryClient.clear();
});
beforeEach(() => {
  run.mockReset();
});
describe("GitHub import cache refresh", () => {
  it.each(["success", "failure"])(
    "refreshes tasks, labels and saved progress after %s",
    async (outcome) => {
      const client = new QueryClient({
        defaultOptions: { mutations: { retry: false } },
      });
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
      const keys = [
        ["tasks", "project"],
        ["labels", "workspace"],
        ["github-integration", "project"],
      ];
      for (const key of keys) queryClient.setQueryData(key, {});
      if (outcome === "success")
        run.mockResolvedValue({
          pending: false,
          imported: 4,
          updated: 0,
          skipped: 0,
        });
      else
        run.mockRejectedValue(
          new Error("connection lost after persisted page"),
        );
      const { result } = renderHook(useImportGithubIssues, { wrapper });
      act(() => result.current.mutate({ projectId: "project" }));
      await waitFor(() =>
        expect(
          outcome === "success"
            ? result.current.isSuccess
            : result.current.isError,
        ).toBe(true),
      );
      for (const key of keys)
        expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
      client.clear();
    },
  );
});

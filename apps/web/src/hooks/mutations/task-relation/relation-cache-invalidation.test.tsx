import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import useCreateTaskRelation from "./use-create-task-relation";
import useDeleteTaskRelation from "./use-delete-task-relation";

vi.mock("@/fetchers/task-relation/create-task-relation", () => ({
  default: async () => ({ sourceTaskId: "parent", targetTaskId: "child" }),
}));
vi.mock("@/fetchers/task-relation/delete-task-relation", () => ({
  default: async () => ({ sourceTaskId: "parent", targetTaskId: "child" }),
}));
afterEach(cleanup);

describe("relation cache updates", () => {
  it.each(["create", "delete"])(
    "refreshes both endpoints and the parent board after %s",
    async (operation) => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      for (const id of ["parent", "child"]) {
        client.setQueryData(["task", id], { id });
        client.setQueryData(["task-relations", id], []);
      }
      client.setQueryData(["tasks", "parent-project"], {
        columns: [],
        plannedTasks: [{ id: "parent" }],
      });
      client.setQueryData(["tasks", "unrelated-project"], {
        columns: [],
        plannedTasks: [{ id: "unrelated" }],
      });
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
      const { result } = renderHook(
        () => ({
          create: useCreateTaskRelation(),
          remove: useDeleteTaskRelation("child"),
        }),
        { wrapper },
      );
      await act(async () => {
        if (operation === "create") {
          await result.current.create.mutateAsync({
            sourceTaskId: "parent",
            targetTaskId: "child",
            relationType: "subtask",
          });
        } else {
          await result.current.remove.mutateAsync("relation");
        }
      });
      for (const id of ["parent", "child"]) {
        expect(client.getQueryState(["task", id])?.isInvalidated).toBe(true);
        expect(
          client.getQueryState(["task-relations", id])?.isInvalidated,
        ).toBe(true);
      }
      expect(
        client.getQueryState(["tasks", "parent-project"])?.isInvalidated,
      ).toBe(true);
      expect(
        client.getQueryState(["tasks", "unrelated-project"])?.isInvalidated,
      ).toBe(false);
      client.clear();
    },
  );
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import type Task from "@/types/task";
import { useUpdateTaskStatus } from "./use-update-task-status";
import { useUpdateTask } from "./use-update-task";
import { useBulkOperations } from "./use-bulk-operations";
const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  bulk: vi.fn(),
  prompt: vi.fn(),
}));
vi.mock("@/fetchers/task/update-task-status", () => ({
  default: mocks.update,
}));
vi.mock("@/fetchers/task/update-task", () => ({ default: mocks.update }));
vi.mock("@/fetchers/task/bulk-operation", () => ({ default: mocks.bulk }));
vi.mock("@/components/task/subtask-status-dialog/store", () => ({
  promptSubtaskStatus: mocks.prompt,
}));
function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      {children}
    </QueryClientProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockResolvedValue({ previousStatus: "to-do" });
  mocks.bulk.mockResolvedValue({ success: true });
});
it.each([useUpdateTaskStatus, useUpdateTask])(
  "prompts after successful terminal-status edits",
  async (hook) => {
    const { result } = renderHook(() => hook(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        id: "p",
        projectId: "project",
        status: "archived",
      } as Task),
    );
    expect(mocks.prompt).toHaveBeenCalledExactlyOnceWith("p", "archived");
  },
);
it("does not prompt on unrelated edits to an already completed task", async () => {
  mocks.update.mockResolvedValue({ previousStatus: "done" });
  const { result } = renderHook(() => useUpdateTask(), { wrapper });
  await act(() =>
    result.current.mutateAsync({
      id: "p",
      projectId: "project",
      status: "done",
    } as Task),
  );
  expect(mocks.prompt).not.toHaveBeenCalled();
});
it("does not prompt after failed parent updates", async () => {
  mocks.update.mockRejectedValue(new Error("offline"));
  const { result } = renderHook(() => useUpdateTaskStatus(), { wrapper });
  await act(async () => {
    await expect(
      result.current.mutateAsync({
        id: "p",
        projectId: "project",
        status: "done",
      } as Task),
    ).rejects.toThrow("offline");
  });
  expect(mocks.prompt).not.toHaveBeenCalled();
});
it("offers the choice for bulk completion and archiving", async () => {
  const { result } = renderHook(() => useBulkOperations(), { wrapper });
  await act(() =>
    result.current.bulkChangeStatus({
      taskIds: ["one", "two"],
      status: "done",
    }),
  );
  expect(mocks.prompt).toHaveBeenCalledWith("one", "done");
  expect(mocks.prompt).toHaveBeenCalledWith("two", "done");
  mocks.prompt.mockClear();
  await act(() => result.current.bulkArchive(["one"]));
  expect(mocks.prompt).toHaveBeenCalledExactlyOnceWith("one", "archived");
});

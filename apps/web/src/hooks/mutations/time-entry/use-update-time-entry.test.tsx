import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import updateTimeEntry from "@/fetchers/time-entry/update-time-entry";
import useUpdateTimeEntry from "./use-update-time-entry";

vi.mock("@/fetchers/time-entry/update-time-entry", () => ({
  default: vi.fn(),
}));

afterEach(cleanup);

it("closes the cached timer before a slow refresh completes and preserves its user name", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { refetchOnMount: false, retry: false } },
  });
  const key = ["time-entries", "task-1"];
  const running = {
    id: "entry-1",
    taskId: "task-1",
    userId: "user-1",
    userName: "Tester",
    description: "Working",
    startTime: "2026-11-14T10:00:00Z",
    endTime: null,
    duration: null,
    createdAt: "2026-11-14T10:00:00Z",
    updatedAt: "2026-11-14T10:00:00Z",
  };
  const { userName, ...entry } = running;
  const stopped = {
    ...entry,
    endTime: "2026-11-14T10:01:00Z",
    duration: 60,
  };
  let finishRefresh!: (entries: Array<typeof running>) => void;
  const refresh = new Promise<Array<typeof running>>((resolve) => {
    finishRefresh = resolve;
  });
  const reload = vi.fn(() => refresh);
  client.setQueryData(key, [running]);
  vi.mocked(updateTimeEntry).mockResolvedValue(stopped);
  const { result, unmount } = renderHook(
    () => {
      useQuery({ queryKey: key, queryFn: reload });
      return useUpdateTimeEntry("task-1");
    },
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );

  await act(async () => {
    await result.current.mutateAsync({
      id: running.id,
      startTime: running.startTime,
      endTime: stopped.endTime,
    });
  });

  expect(reload).toHaveBeenCalledTimes(1);
  expect(client.getQueryState(key)?.fetchStatus).toBe("fetching");
  expect(client.getQueryData(key)).toEqual([{ ...stopped, userName }]);
  expect(result.current.isPending).toBe(false);
  await act(async () => finishRefresh([]));
  unmount();
  client.clear();
});

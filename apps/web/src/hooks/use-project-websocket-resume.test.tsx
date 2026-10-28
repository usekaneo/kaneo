import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { ResumePreview } from "@/fetchers/integration-sync/types";
import { useResumePreview } from "./queries/integration-sync/use-resume-preview";
import { useProjectWebSocket } from "./use-project-websocket";

const mocks = vi.hoisted(() => ({ review: vi.fn(), navigate: vi.fn() }));
vi.mock("@/fetchers/integration-sync/review-sync-resume", () => ({
  default: mocks.review,
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("@kaneo/libs", () => ({ windowId: "test" }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: "user" } } }) },
}));

class Socket {
  static current: Socket;
  onmessage: ((event: { data: string }) => void) | null = null;
  close() {}
  constructor() {
    Socket.current = this;
  }
  message(taskId: string) {
    this.onmessage?.({
      data: JSON.stringify({ type: "TASK_UPDATED", taskId }),
    });
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("refreshes only the affected open comparison before accepting its new token", async () => {
  vi.stubGlobal("WebSocket", Socket);
  const client = new QueryClient();
  const initial: ResumePreview = {
    task: { id: "task", title: "Old", number: 1 },
    local: { title: "Old", description: "", state: "open" },
    remote: { title: "Remote", description: "", state: "open" },
    token: "old-token",
  };
  let finish!: (value: ResumePreview) => void;
  mocks.review
    .mockReset()
    .mockResolvedValueOnce(initial)
    .mockImplementationOnce(
      () =>
        new Promise<ResumePreview>((resolve) => {
          finish = resolve;
        }),
    );
  const { result } = renderHook(
    () => {
      useProjectWebSocket("project");
      const preview = useResumePreview(
        { projectId: "project", provider: "github" },
        "link",
        "task",
      );
      return { data: preview.data, isFetching: preview.isFetching };
    },
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  await waitFor(() => expect(result.current.data).toEqual(initial));
  expect(
    client.getQueriesData({
      queryKey: ["integration-sync-review", "project"],
      type: "active",
    }),
  ).toEqual([
    [["integration-sync-review", "project", "github", "link"], initial],
  ]);
  const invalidation = vi.spyOn(client, "invalidateQueries");
  client.setQueryData(
    ["integration-sync-review", "project", "github", "inactive"],
    initial,
  );
  client.setQueryData(
    ["integration-sync-review", "other-project", "github", "link"],
    initial,
  );
  act(() => Socket.current.message("unrelated-task"));
  expect(mocks.review).toHaveBeenCalledOnce();
  let resolveBoard!: (value: null) => void;
  const boardFetch = client.fetchQuery({
    queryKey: ["tasks", "project"],
    queryFn: () =>
      new Promise((resolve) => {
        resolveBoard = resolve;
      }),
  });
  act(() => Socket.current.message("task"));
  expect(invalidation).toHaveBeenCalledWith({
    queryKey: ["integration-sync-review", "project", "github", "link"],
    exact: true,
  });
  await waitFor(() => expect(result.current.isFetching).toBe(true));
  expect(mocks.review).toHaveBeenCalledTimes(2);
  expect(
    client.getQueryState([
      "integration-sync-review",
      "project",
      "github",
      "inactive",
    ])?.isInvalidated,
  ).toBe(false);
  expect(
    client.getQueryState([
      "integration-sync-review",
      "other-project",
      "github",
      "link",
    ])?.isInvalidated,
  ).toBe(false);
  act(() =>
    finish({
      ...initial,
      task: { ...initial.task, title: "Current" },
      local: { ...initial.local, title: "Current" },
      token: "current-token",
    }),
  );
  await waitFor(() => {
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data?.local.title).toBe("Current");
    expect(result.current.data?.token).toBe("current-token");
  });
  cleanup();
  resolveBoard(null);
  await boardFetch;
  client.clear();
});

it("replaces a pre-edit initial review fetch and ignores its late response", async () => {
  vi.stubGlobal("WebSocket", Socket);
  const client = new QueryClient();
  const stale: ResumePreview = {
    task: { id: "task", title: "Old", number: 1 },
    local: { title: "Old", description: "", state: "open" },
    remote: { title: "Remote", description: "", state: "open" },
    token: "old-token",
  };
  let originalSignal: AbortSignal | undefined;
  let finishOriginal!: (value: ResumePreview) => void;
  let finishCurrent!: (value: ResumePreview) => void;
  mocks.review
    .mockReset()
    .mockImplementationOnce((_param, _link, signal) => {
      originalSignal = signal;
      return new Promise<ResumePreview>((resolve) => {
        finishOriginal = resolve;
      });
    })
    .mockImplementationOnce(
      () =>
        new Promise<ResumePreview>((resolve) => {
          finishCurrent = resolve;
        }),
    );
  const { result } = renderHook(
    () => {
      useProjectWebSocket("project");
      const preview = useResumePreview(
        { projectId: "project", provider: "github" },
        "link",
        "task",
      );
      return { data: preview.data, isFetching: preview.isFetching };
    },
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  await waitFor(() => expect(mocks.review).toHaveBeenCalledOnce());
  act(() => Socket.current.message("unrelated-task"));
  expect(mocks.review).toHaveBeenCalledOnce();
  act(() => Socket.current.message("task"));
  await waitFor(() => expect(mocks.review).toHaveBeenCalledTimes(2));
  expect(originalSignal?.aborted).toBe(true);
  await act(async () => finishOriginal(stale));
  expect(result.current.data).toBeUndefined();
  expect(result.current.isFetching).toBe(true);
  act(() =>
    finishCurrent({
      ...stale,
      task: { ...stale.task, title: "Current" },
      local: { ...stale.local, title: "Current" },
      token: "current-token",
    }),
  );
  await waitFor(() => {
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data?.token).toBe("current-token");
  });
  cleanup();
  client.clear();
});

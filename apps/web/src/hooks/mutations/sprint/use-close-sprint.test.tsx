import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useCloseSprint } from "./use-close-sprint";

const { closeSprint } = vi.hoisted(() => ({ closeSprint: vi.fn() }));

vi.mock("@/fetchers/sprint/close-sprint", () => ({
  default: closeSprint,
}));

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  client.setQueryData(["sprints", "project-1"], []);
  client.setQueryData(["tasks", "project-1"], { id: "project-1" });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useCloseSprint(), { wrapper }) };
}

afterEach(cleanup);

beforeEach(() => {
  closeSprint.mockReset();
});

describe("useCloseSprint", () => {
  it("closes the sprint and invalidates both the sprints and the moved tasks", async () => {
    closeSprint.mockResolvedValueOnce({
      sprint: { id: "sprint-1", status: "closed" },
      movedTaskIds: ["task-1"],
      targetSprintId: "sprint-2",
    });
    const { client, result } = setup();

    await act(async () => {
      await result.current.mutateAsync({
        id: "sprint-1",
        projectId: "project-1",
        targetSprintId: "sprint-2",
      });
    });

    expect(closeSprint).toHaveBeenCalledWith("sprint-1", "sprint-2");
    expect(
      client.getQueryState(["sprints", "project-1"])?.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryState(["tasks", "project-1"])?.isInvalidated,
    ).toBe(true);
    client.clear();
  });

  it("closes the sprint towards the backlog", async () => {
    closeSprint.mockResolvedValueOnce({
      sprint: { id: "sprint-1", status: "closed" },
      movedTaskIds: [],
      targetSprintId: null,
    });
    const { result } = setup();

    await act(async () => {
      await result.current.mutateAsync({
        id: "sprint-1",
        projectId: "project-1",
        targetSprintId: null,
      });
    });

    expect(closeSprint).toHaveBeenCalledWith("sprint-1", null);
  });
});

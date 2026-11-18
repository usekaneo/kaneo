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
import { useStartSprint } from "./use-start-sprint";

const { startSprint } = vi.hoisted(() => ({ startSprint: vi.fn() }));

vi.mock("@/fetchers/sprint/start-sprint", () => ({
  default: startSprint,
}));

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  client.setQueryData(["sprints", "project-1"], []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useStartSprint(), { wrapper }) };
}

afterEach(cleanup);

beforeEach(() => {
  startSprint.mockReset();
});

describe("useStartSprint", () => {
  it("starts the sprint and invalidates the project's sprint list", async () => {
    startSprint.mockResolvedValueOnce({ id: "sprint-1", status: "active" });
    const { client, result } = setup();

    await act(async () => {
      await result.current.mutateAsync({
        id: "sprint-1",
        projectId: "project-1",
        data: { startDate: "2025-01-15" },
      });
    });

    expect(startSprint).toHaveBeenCalledWith("sprint-1", {
      startDate: "2025-01-15",
    });
    expect(
      client.getQueryState(["sprints", "project-1"])?.isInvalidated,
    ).toBe(true);
    client.clear();
  });

  it("forwards a start without a date range", async () => {
    startSprint.mockResolvedValueOnce({ id: "sprint-1", status: "active" });
    const { result } = setup();

    await act(async () => {
      await result.current.mutateAsync({
        id: "sprint-1",
        projectId: "project-1",
      });
    });

    expect(startSprint).toHaveBeenCalledWith("sprint-1", undefined);
  });
});

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
import { useUpdateSprint } from "./use-update-sprint";

const { updateSprint } = vi.hoisted(() => ({ updateSprint: vi.fn() }));

vi.mock("@/fetchers/sprint/update-sprint", () => ({
  default: updateSprint,
}));

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  client.setQueryData(["sprints", "project-1"], []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useUpdateSprint(), { wrapper }) };
}

afterEach(cleanup);

beforeEach(() => {
  updateSprint.mockReset();
});

describe("useUpdateSprint", () => {
  it("updates the sprint and invalidates the project's sprint list", async () => {
    updateSprint.mockResolvedValueOnce({ id: "sprint-1", goal: "New goal" });
    const { client, result } = setup();

    await act(async () => {
      await result.current.mutateAsync({
        id: "sprint-1",
        projectId: "project-1",
        data: { goal: "New goal" },
      });
    });

    expect(updateSprint).toHaveBeenCalledWith("sprint-1", {
      goal: "New goal",
    });
    expect(
      client.getQueryState(["sprints", "project-1"])?.isInvalidated,
    ).toBe(true);
    client.clear();
  });
});

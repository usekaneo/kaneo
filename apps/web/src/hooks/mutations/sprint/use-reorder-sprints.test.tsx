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
import { useReorderSprints } from "./use-reorder-sprints";

const { reorderSprints } = vi.hoisted(() => ({ reorderSprints: vi.fn() }));

vi.mock("@/fetchers/sprint/reorder-sprints", () => ({
  default: reorderSprints,
}));

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  client.setQueryData(["sprints", "project-1"], []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useReorderSprints(), { wrapper }) };
}

afterEach(cleanup);

beforeEach(() => {
  reorderSprints.mockReset();
});

describe("useReorderSprints", () => {
  it("posts the new order and invalidates the project's sprint list", async () => {
    reorderSprints.mockResolvedValueOnce([
      { id: "sprint-2", position: 0 },
      { id: "sprint-1", position: 1 },
    ]);
    const { client, result } = setup();

    await act(async () => {
      await result.current.mutateAsync({
        projectId: "project-1",
        sprints: [
          { id: "sprint-2", position: 0 },
          { id: "sprint-1", position: 1 },
        ],
      });
    });

    expect(reorderSprints).toHaveBeenCalledWith("project-1", [
      { id: "sprint-2", position: 0 },
      { id: "sprint-1", position: 1 },
    ]);
    expect(
      client.getQueryState(["sprints", "project-1"])?.isInvalidated,
    ).toBe(true);
    client.clear();
  });
});

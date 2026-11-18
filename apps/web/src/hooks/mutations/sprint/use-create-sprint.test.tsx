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
import { useCreateSprint } from "./use-create-sprint";

const { createSprint } = vi.hoisted(() => ({ createSprint: vi.fn() }));

vi.mock("@/fetchers/sprint/create-sprint", () => ({
  default: createSprint,
}));

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  client.setQueryData(["sprints", "project-1"], []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useCreateSprint(), { wrapper }) };
}

afterEach(cleanup);

beforeEach(() => {
  createSprint.mockReset();
});

describe("useCreateSprint", () => {
  it("creates the sprint and invalidates the project's sprint list", async () => {
    createSprint.mockResolvedValueOnce({ id: "sprint-1", status: "future" });
    const { client, result } = setup();

    await act(async () => {
      await result.current.mutateAsync({
        projectId: "project-1",
        data: { name: "Sprint 1" },
      });
    });

    expect(createSprint).toHaveBeenCalledWith("project-1", {
      name: "Sprint 1",
    });
    expect(
      client.getQueryState(["sprints", "project-1"])?.isInvalidated,
    ).toBe(true);
    client.clear();
  });

  it("keeps the stale sprint list when creation fails", async () => {
    createSprint.mockRejectedValueOnce(new Error("duplicate name"));
    const { client, result } = setup();

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          projectId: "project-1",
          data: { name: "Sprint 1" },
        });
      }),
    ).rejects.toThrow("duplicate name");

    expect(
      client.getQueryState(["sprints", "project-1"])?.isInvalidated,
    ).toBe(false);
    client.clear();
  });
});

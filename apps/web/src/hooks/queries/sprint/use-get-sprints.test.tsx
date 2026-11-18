import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useGetSprints } from "./use-get-sprints";

const { getSprints } = vi.hoisted(() => ({ getSprints: vi.fn() }));

vi.mock("@/fetchers/sprint/get-sprints", () => ({
  default: getSprints,
}));

const sprints = [
  { id: "sprint-1", name: "Sprint 1", status: "active" },
  { id: "sprint-2", name: "Sprint 2", status: "future" },
];

function setup(projectId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useGetSprints(projectId), { wrapper }) };
}

afterEach(cleanup);

beforeEach(() => {
  getSprints.mockReset();
});

describe("useGetSprints", () => {
  it("loads the sprint list of the selected project", async () => {
    getSprints.mockResolvedValueOnce(sprints);
    const { client, result } = setup("project-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getSprints).toHaveBeenCalledWith("project-1");
    expect(result.current.data).toEqual(sprints);
    client.clear();
  });

  it("stays idle without a project so the backlog does not fetch", async () => {
    const { client, result } = setup("");

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(getSprints).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");
    client.clear();
  });
});

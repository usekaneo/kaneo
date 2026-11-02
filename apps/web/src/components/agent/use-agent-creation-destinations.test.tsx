import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import getColumns from "@/fetchers/column/get-columns";
import getProject from "@/fetchers/project/get-project";
import type { AgentProposal } from "@/types/agent";
import { useAgentCreationDestinations } from "./use-agent-creation-destinations";

vi.mock("@/fetchers/column/get-columns", () => ({ default: vi.fn() }));
vi.mock("@/fetchers/project/get-project", () => ({ default: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

const proposals = [
  {
    id: "create",
    action: { type: "task.create", projectId: "bravo", status: "done" },
  },
] as AgentProposal[];
function setup(items = proposals) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    ...renderHook(() => useAgentCreationDestinations("workspace", items), {
      wrapper,
    }),
  };
}

describe("useAgentCreationDestinations", () => {
  it("resolves readable project and status names, sharing queries for repeated destinations", async () => {
    vi.mocked(getProject).mockResolvedValue({
      name: "Project Bravo",
    } as Awaited<ReturnType<typeof getProject>>);
    vi.mocked(getColumns).mockResolvedValue([
      { slug: "done", name: "Finished" },
    ] as Awaited<ReturnType<typeof getColumns>>);
    const { result } = setup([
      ...proposals,
      { ...proposals[0]!, id: "second" },
    ]);
    await waitFor(() => expect(result.current.get("create")?.ready).toBe(true));
    expect(result.current.get("create")).toMatchObject({
      projectName: "Project Bravo",
      statusName: "Finished",
    });
    expect(getProject).toHaveBeenCalledOnce();
    expect(getColumns).toHaveBeenCalledOnce();
  });

  it("does not allow a creation when its initial status no longer exists", async () => {
    vi.mocked(getProject).mockResolvedValue({
      name: "Project Bravo",
    } as Awaited<ReturnType<typeof getProject>>);
    vi.mocked(getColumns).mockResolvedValue([]);
    const { result } = setup();
    await waitFor(() =>
      expect(result.current.get("create")?.pending).toBe(false),
    );
    expect(result.current.get("create")?.ready).toBe(false);
  });

  it("revokes readiness after a cached project's access check fails", async () => {
    vi.mocked(getProject).mockResolvedValue({
      name: "Project Bravo",
    } as Awaited<ReturnType<typeof getProject>>);
    vi.mocked(getColumns).mockResolvedValue([
      { slug: "done", name: "Finished" },
    ] as Awaited<ReturnType<typeof getColumns>>);
    const { result, client } = setup();
    await waitFor(() => expect(result.current.get("create")?.ready).toBe(true));
    vi.mocked(getProject).mockRejectedValue(new Error("Access revoked"));
    await act(async () => {
      await client.invalidateQueries({
        queryKey: ["projects", "workspace", "bravo"],
      });
    });
    await waitFor(() =>
      expect(result.current.get("create")?.ready).toBe(false),
    );
  });
});

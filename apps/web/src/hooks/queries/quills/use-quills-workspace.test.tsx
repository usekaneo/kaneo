import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import getQuillsWorkspaceContext from "@/fetchers/quills/get-workspace-context";
import { HttpError } from "@/lib/http-error";
import queryClient from "@/query-client";
import useQuillsWorkspace from "./use-quills-workspace";
const state = vi.hoisted(() => ({
  workspace: { id: "a", name: "Alpha", slug: "alpha" },
  route: "a",
  allowed: true,
  loading: false,
  userId: "alice" as string | undefined,
  pending: false,
}));
vi.mock("@tanstack/react-router", () => ({ useParams: () => state.route }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: state.userId ? { user: { id: state.userId } } : null,
      isPending: state.pending,
    }),
  },
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({
    data: state.workspace,
    isLoading: state.loading,
    isError: false,
  }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canReadQuills: () => state.allowed }),
}));
vi.mock("@/fetchers/quills/get-workspace-context", () => ({
  default: vi.fn(),
}));
vi.mock("@/lib/http-error", async (original) => ({
  ...(await original<typeof import("@/lib/http-error")>()),
  handleUnauthorized: vi.fn(),
}));
vi.mock("@sentry/react", () => ({ captureException: vi.fn() }));
function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
const value = (userId = state.userId!) => ({
  workspace: state.workspace,
  actor: {
    principalId: `${userId}-actor`,
    userId,
    workspaceId: state.workspace.id,
  },
});
beforeEach(() => {
  state.workspace = { id: "a", name: "Alpha", slug: "alpha" };
  state.route = "a";
  state.allowed = true;
  state.loading = false;
  state.userId = "alice";
  state.pending = false;
  vi.mocked(getQuillsWorkspaceContext)
    .mockReset()
    .mockImplementation(async () => value());
});
afterEach(() => {
  cleanup();
  queryClient.clear();
});
describe("Quills shared workspace context", () => {
  it("hides cached data after permission loss", async () => {
    const { result, rerender } = renderHook(useQuillsWorkspace, { wrapper });
    await waitFor(() =>
      expect(result.current.data?.actor.userId).toBe("alice"),
    );
    state.allowed = false;
    rerender();
    expect(result.current.data).toBeUndefined();
  });
  it("waits for the route workspace and the session identity", async () => {
    state.route = "b";
    const { result, rerender } = renderHook(useQuillsWorkspace, { wrapper });
    expect(getQuillsWorkspaceContext).not.toHaveBeenCalled();
    state.workspace = { id: "b", name: "Beta", slug: "beta" };
    state.pending = true;
    rerender();
    expect(getQuillsWorkspaceContext).not.toHaveBeenCalled();
    state.pending = false;
    rerender();
    await waitFor(() => expect(result.current.data?.workspace.id).toBe("b"));
    expect(getQuillsWorkspaceContext).toHaveBeenCalledWith("b");
    state.userId = undefined;
    rerender();
    expect(result.current.data).toBeUndefined();
  });
  it("does not reuse another account's actor in the same workspace", async () => {
    const first = renderHook(useQuillsWorkspace, { wrapper });
    await waitFor(() =>
      expect(first.result.current.data?.actor.userId).toBe("alice"),
    );
    first.unmount();
    state.userId = "bob";
    const second = renderHook(useQuillsWorkspace, { wrapper });
    expect(second.result.current.data?.actor.userId).not.toBe("alice");
    await waitFor(() =>
      expect(second.result.current.data?.actor.userId).toBe("bob"),
    );
    expect(getQuillsWorkspaceContext).toHaveBeenCalledTimes(2);
  });
  it.each([401, 403, 404])(
    "hides cached context after HTTP %s despite stale capabilities",
    async (status) => {
      const { result } = renderHook(useQuillsWorkspace, { wrapper });
      await waitFor(() =>
        expect(result.current.data?.actor.userId).toBe("alice"),
      );
      vi.mocked(getQuillsWorkspaceContext).mockRejectedValue(
        new HttpError(status, "Access denied"),
      );
      await act(async () => {
        await result.current.refetch();
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.data).toBeUndefined();
    },
  );
});

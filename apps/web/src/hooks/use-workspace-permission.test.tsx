import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { workspaceCapabilities } from "@kaneo/permissions";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useWorkspacePermission } from "./use-workspace-permission";

const { getMyCapabilities, hasPermission } = vi.hoisted(() => ({
  getMyCapabilities: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock("@/fetchers/workspace/get-my-capabilities", () => ({
  default: getMyCapabilities,
}));

vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "workspace-1" } }),
}));

vi.mock("@/hooks/queries/workspace-users/use-active-workspace-user", () => ({
  useGetActiveWorkspaceUser: () => ({ data: { role: "member" } }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    organization: { hasPermission },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useWorkspacePermission", () => {
  beforeEach(() => {
    getMyCapabilities.mockReset();
    hasPermission.mockReset();
  });

  it("keeps update capabilities independent from delete capabilities", async () => {
    const granted = {
      task: new Set(["create", "read", "update"]),
      label: new Set(["create", "read", "update"]),
    } as Record<string, Set<string>>;

    getMyCapabilities.mockResolvedValue(
      Object.fromEntries(
        Object.entries(workspaceCapabilities).map(([name, permissions]) => [
          name,
          Object.entries(
            permissions as Record<string, readonly string[]>,
          ).every(([resource, actions]) =>
            actions.every((action) => granted[resource]?.has(action)),
          ),
        ]),
      ),
    );

    const { result } = renderHook(() => useWorkspacePermission(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isCheckingPermissions).toBe(false);
    });

    expect(result.current.canCreateTasks()).toBe(true);
    expect(result.current.canUpdateTasks()).toBe(true);
    expect(result.current.canDeleteTasks()).toBe(false);
    expect(result.current.canCreateLabels()).toBe(true);
    expect(result.current.canUpdateLabels()).toBe(true);
    expect(result.current.canDeleteLabels()).toBe(false);
  });

  it("loads every capability in a single request", async () => {
    getMyCapabilities.mockResolvedValue({});

    const { result } = renderHook(() => useWorkspacePermission(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isCheckingPermissions).toBe(false);
    });

    expect(getMyCapabilities).toHaveBeenCalledTimes(1);
    expect(getMyCapabilities).toHaveBeenCalledWith("workspace-1");
    expect(hasPermission).not.toHaveBeenCalled();
  });
});

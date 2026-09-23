import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspacePermission } from "./use-workspace-permission";

const { hasPermission } = vi.hoisted(() => ({
  hasPermission: vi.fn(),
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
    hasPermission.mockReset();
  });

  it("keeps update capabilities independent from delete capabilities", async () => {
    const granted = {
      task: new Set(["create", "read", "update"]),
      label: new Set(["create", "read", "update"]),
    } as Record<string, Set<string>>;

    hasPermission.mockImplementation(
      async ({ permissions }: { permissions: Record<string, string[]> }) => ({
        data: {
          success: Object.entries(permissions).every(([resource, actions]) =>
            actions.every((action) => granted[resource]?.has(action)),
          ),
        },
      }),
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
});

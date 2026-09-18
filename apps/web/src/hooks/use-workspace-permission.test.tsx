import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspacePermission } from "./use-workspace-permission";

const { getPermissions } = vi.hoisted(() => ({
  getPermissions: vi.fn(),
}));

vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "workspace-1" } }),
}));

vi.mock("@/hooks/queries/workspace-users/use-active-workspace-user", () => ({
  useGetActiveWorkspaceUser: () => ({ data: { role: "member" } }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { organization: { hasPermission: vi.fn() } },
}));

vi.mock("@kaneo/libs", () => ({
  client: {
    workspace: {
      ":workspaceId": { permissions: { $get: getPermissions } },
    },
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

function respond(body: unknown, ok = true) {
  getPermissions.mockResolvedValue({ ok, json: async () => body });
}

describe("useWorkspacePermission", () => {
  beforeEach(() => {
    getPermissions.mockReset();
  });

  it("keeps update capabilities independent from delete capabilities", async () => {
    respond({
      task: ["create", "read", "update"],
      label: ["create", "read", "update"],
    });

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

  it("asks the server once, however many capabilities there are", async () => {
    respond({ payroll: ["read"], people: ["read_all"] });

    const { result } = renderHook(() => useWorkspacePermission(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isCheckingPermissions).toBe(false);
    });

    expect(getPermissions).toHaveBeenCalledTimes(1);
    expect(result.current.canSeePay()).toBe(true);
    expect(result.current.canManagePay()).toBe(false);
    expect(result.current.canSeePeople()).toBe(true);
  });

  it("grants nothing when the permissions request fails", async () => {
    respond({}, false);

    const { result } = renderHook(() => useWorkspacePermission(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isCheckingPermissions).toBe(false);
    });

    expect(result.current.canUpdateTasks()).toBe(false);
  });
});

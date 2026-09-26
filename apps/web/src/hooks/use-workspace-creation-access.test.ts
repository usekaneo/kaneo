import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useWorkspaceCreationAccess from "./use-workspace-creation-access";

const { getSession, useAuth, useGetConfig } = vi.hoisted(() => ({
  getSession: vi.fn(),
  useAuth: vi.fn(),
  useGetConfig: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { getSession },
}));

vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: useAuth,
}));

vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: useGetConfig,
}));

describe("useWorkspaceCreationAccess", () => {
  beforeEach(() => {
    getSession.mockReset();
    useAuth.mockReset();
    useGetConfig.mockReset();
    useGetConfig.mockReturnValue({
      data: { disableWorkspaceCreation: true },
      isPending: false,
    });
  });

  it("does not restrict a refreshed multi-role user that includes admin", async () => {
    useAuth.mockReturnValue({ user: { role: "user" } });
    getSession.mockResolvedValue({
      data: { user: { role: "user,admin" } },
      error: null,
    });

    const { result } = renderHook(() => useWorkspaceCreationAccess());

    await waitFor(() => expect(result.current.isDecided).toBe(true));
    expect(result.current.isCreationRestricted).toBe(false);
    expect(result.current.canCreateWorkspace).toBe(true);
  });

  it("restricts a refreshed non-admin when creation is disabled", async () => {
    useAuth.mockReturnValue({ user: { role: "user" } });
    getSession.mockResolvedValue({
      data: { user: { role: "user" } },
      error: null,
    });

    const { result } = renderHook(() => useWorkspaceCreationAccess());

    await waitFor(() => expect(result.current.isDecided).toBe(true));
    expect(result.current.isCreationRestricted).toBe(true);
    expect(result.current.canCreateWorkspace).toBe(false);
  });

  it("falls back to the cached multi-role admin when the refresh fails", async () => {
    useAuth.mockReturnValue({ user: { role: "user,admin" } });
    getSession.mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useWorkspaceCreationAccess());

    await waitFor(() => expect(result.current.isDecided).toBe(true));
    expect(result.current.isCreationRestricted).toBe(false);
    expect(result.current.canCreateWorkspace).toBe(true);
  });
});

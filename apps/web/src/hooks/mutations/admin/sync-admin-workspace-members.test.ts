import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vite-plus/test";
import type { AdminWorkspaceMember } from "@/fetchers/admin/workspace-types";
import { syncAdminWorkspaceMembers } from "./sync-admin-workspace-members";

vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: null }),
}));

const members: AdminWorkspaceMember[] = [
  {
    userId: "ada",
    name: "Ada Lovelace",
    email: "ada@example.com",
    image: null,
    role: "owner",
    joinedAt: "2026-01-02T00:00:00.000Z",
  },
];

describe("syncAdminWorkspaceMembers", () => {
  it("stores the returned members and refreshes the affected lists", () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    syncAdminWorkspaceMembers(queryClient, "acme", members);

    expect(
      queryClient.getQueryData(["admin", "workspace-members", "acme"]),
    ).toEqual(members);
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(
      [
        ["admin", "workspaces"],
        ["workspace-users", "acme"],
        ["workspace", "full", "acme"],
      ],
    );
  });

  it("leaves other workspaces' member lists alone", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["admin", "workspace-members", "other"], []);

    syncAdminWorkspaceMembers(queryClient, "acme", members);

    expect(
      queryClient.getQueryData(["admin", "workspace-members", "other"]),
    ).toEqual([]);
  });
});

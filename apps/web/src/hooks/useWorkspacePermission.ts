import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import useWorkspaceStore from "@/store/workspace";

export type PermissionLevel = "owner" | "member";

export function useWorkspacePermission() {
  const { workspace } = useWorkspaceStore();
  const { user } = useAuth();

  const isOwner = workspace?.ownerEmail === user?.email;

  const checkPermission = (
    requiredRole: PermissionLevel = "member",
  ): boolean => {
    if (!workspace || !user) return false;

    if (requiredRole === "owner") {
      return isOwner;
    }

    return isOwner;
  };

  return {
    isOwner,
    checkPermission,
  };
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ADMIN_USERS_QUERY_KEY } from "@/hooks/queries/admin/use-admin-users";
import { authClient } from "@/lib/auth-client";

type ToggleAdminUserStatusRequest = {
  userId: string;
  deactivate: boolean;
};

function useToggleAdminUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      deactivate,
    }: ToggleAdminUserStatusRequest) => {
      const result = deactivate
        ? await authClient.admin.banUser({
            userId,
            banReason: "Deactivated by an instance administrator",
          })
        : await authClient.admin.unbanUser({ userId });

      if (result.error) {
        throw new Error(
          result.error.message ||
            (deactivate
              ? "Failed to deactivate user"
              : "Failed to reactivate user"),
        );
      }

      return result.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY }),
  });
}

export default useToggleAdminUserStatus;

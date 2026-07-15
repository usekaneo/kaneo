import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ADMIN_USERS_QUERY_KEY } from "@/hooks/queries/admin/use-admin-users";
import { authClient } from "@/lib/auth-client";

function useDeleteAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await authClient.admin.removeUser({ userId });

      if (error) {
        throw new Error(error.message || "Failed to delete user");
      }

      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY }),
  });
}

export default useDeleteAdminUser;

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteAdminUser } from "@/fetchers/admin/delete-admin-user";
import { ADMIN_USERS_QUERY_KEY } from "@/hooks/queries/admin/use-admin-users";

function useDeleteAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => deleteAdminUser(userId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY }),
  });
}

export default useDeleteAdminUser;

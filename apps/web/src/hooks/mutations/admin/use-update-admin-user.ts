import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateAdminUserRequest } from "@/fetchers/admin/types";
import { updateAdminUser } from "@/fetchers/admin/update-admin-user";
import { ADMIN_USERS_QUERY_KEY } from "@/hooks/queries/admin/use-admin-users";

function useUpdateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateAdminUserRequest) => updateAdminUser(request),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY }),
  });
}

export default useUpdateAdminUser;

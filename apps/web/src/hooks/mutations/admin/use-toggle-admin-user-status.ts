import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toggleAdminUserStatus } from "@/fetchers/admin/toggle-admin-user-status";
import type { ToggleAdminUserStatusRequest } from "@/fetchers/admin/types";
import { ADMIN_USERS_QUERY_KEY } from "@/hooks/queries/admin/use-admin-users";

function useToggleAdminUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ToggleAdminUserStatusRequest) =>
      toggleAdminUserStatus(request),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY }),
  });
}

export default useToggleAdminUserStatus;

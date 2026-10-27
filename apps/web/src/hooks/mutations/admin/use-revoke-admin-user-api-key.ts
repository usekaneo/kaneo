import { useMutation, useQueryClient } from "@tanstack/react-query";
import { revokeAdminUserApiKey } from "@/fetchers/admin/revoke-admin-user-api-key";
import { adminUserApiKeysQueryKey } from "@/hooks/queries/admin/use-admin-user-api-keys";

function useRevokeAdminUserApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeAdminUserApiKey,
    onSettled: (_data, _error, { userId }) =>
      queryClient.invalidateQueries({
        queryKey: adminUserApiKeysQueryKey(userId),
      }),
  });
}

export default useRevokeAdminUserApiKey;

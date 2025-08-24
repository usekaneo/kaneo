import { authClient } from "@/lib/auth-client";

function useActiveWorkspace() {
  const { data: activeOrganization, error } =
    authClient.useActiveOrganization();

  return {
    data: activeOrganization,
    error,
    isLoading: !activeOrganization && !error,
    isError: !!error,
  };
}

export default useActiveWorkspace;

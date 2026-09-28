import { useQuery } from "@tanstack/react-query";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { authClient } from "@/lib/auth-client";

function useListAccounts() {
  const { user } = useAuth();

  return useQuery({
    // Key by the current user so a replaced in-app session cannot reuse the
    // previous user's account list (the global client disables refetchOnMount).
    queryKey: ["accounts", user?.id],
    queryFn: async () => {
      const result = await authClient.listAccounts();

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result.data ?? [];
    },
    enabled: !!user?.id,
  });
}

export default useListAccounts;

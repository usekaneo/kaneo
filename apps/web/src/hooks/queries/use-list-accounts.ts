import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

function useListAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const result = await authClient.listAccounts();

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result.data ?? [];
    },
  });
}

export default useListAccounts;

import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import type { ApiKey } from "@/types/api-key";

function useGetApiKeys() {
  return useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const result = await authClient.apiKey.list();

      if (result.error) {
        throw new Error(result.error.message);
      }

      return (result.data || []) as ApiKey[];
    },
  });
}

export default useGetApiKeys;


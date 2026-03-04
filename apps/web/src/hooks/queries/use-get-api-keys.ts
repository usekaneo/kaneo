import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

function useGetApiKeys() {
  return useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const result = await authClient.apiKey.list();

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result.data.apiKeys || [];
    },
  });
}

export default useGetApiKeys;

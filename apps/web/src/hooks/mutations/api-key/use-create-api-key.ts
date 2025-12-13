import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import type {
  CreateApiKeyRequest,
  CreateApiKeyResponse,
} from "@/types/api-key";

function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateApiKeyRequest) => {
      const result = await authClient.apiKey.create({
        name: data.name,
        expiresIn: data.expiresIn,
        prefix: data.prefix,
        metadata: data.metadata,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result.data as CreateApiKeyResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
}

export default useCreateApiKey;

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteTangledConnection,
  getTangledConnection,
  saveTangledConnection,
  type TangledConnectionInput,
} from "@/fetchers/tangled-integration/connection";

export function useTangledIntegration(projectId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["tangled-integration", projectId];
  const query = useQuery({
    queryKey,
    queryFn: () => getTangledConnection(projectId),
    enabled: Boolean(projectId),
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey });
    await queryClient.invalidateQueries({
      queryKey: ["tangled-outcome", projectId],
    });
  };
  const save = useMutation({
    mutationFn: (input: Partial<TangledConnectionInput>) =>
      saveTangledConnection(projectId, input, Boolean(query.data)),
    onSuccess: refresh,
  });
  const disconnect = useMutation({
    mutationFn: () => deleteTangledConnection(projectId),
    onSuccess: refresh,
  });
  return {
    ...query,
    save: save.mutateAsync,
    disconnect: disconnect.mutateAsync,
    isPending: save.isPending || disconnect.isPending,
  };
}

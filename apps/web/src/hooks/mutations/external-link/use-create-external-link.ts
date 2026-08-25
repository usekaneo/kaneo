import { useMutation, useQueryClient } from "@tanstack/react-query";
import createExternalLink, {
  type CreateExternalLinkRequest,
} from "@/fetchers/external-link/create-external-link";

function useCreateExternalLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateExternalLinkRequest) =>
      createExternalLink(request),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["external-links", variables.taskId],
      });
    },
  });
}

export default useCreateExternalLink;

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import createExternalLink, {
  type CreateExternalLinkRequest,
} from "@/fetchers/external-link/create-external-link";
import { toast } from "@/lib/toast";

function useCreateExternalLink() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (request: CreateExternalLinkRequest) =>
      createExternalLink(request),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["external-links", variables.taskId],
      });
    },
    onError: () => {
      toast.error(t("common:error.messages.unknown"));
    },
  });
}

export default useCreateExternalLink;

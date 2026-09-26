import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import deleteExternalLink from "@/fetchers/external-link/delete-external-link";
import { toast } from "@/lib/toast";

export default function useDeleteExternalLink() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: deleteExternalLink,
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({
        queryKey: ["external-links", variables.taskId],
      }),
    onError: () => toast.error(t("settings:externalLinks.removeError")),
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createExternalLink,
  deleteExternalLink,
  updateExternalLink,
} from "../../../fetchers/external-links";
import type {
  CreateExternalLinkRequest,
  UpdateExternalLinkRequest,
} from "../../../types/external-links";

export function useCreateExternalLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateExternalLinkRequest) => createExternalLink(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["external-links", variables.taskId],
      });
    },
  });
}

export function useUpdateExternalLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      linkId,
      data,
    }: { linkId: string; data: UpdateExternalLinkRequest }) =>
      updateExternalLink(linkId, data),
    onSuccess: (result) => {
      if (result.success && result.data) {
        queryClient.invalidateQueries({
          queryKey: ["external-links", result.data.taskId],
        });
      }
    },
  });
}

export function useDeleteExternalLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) => deleteExternalLink(linkId),
    onSuccess: (result) => {
      if (result.success && result.data) {
        queryClient.invalidateQueries({
          queryKey: ["external-links", result.data.taskId],
        });
      }
    },
  });
}

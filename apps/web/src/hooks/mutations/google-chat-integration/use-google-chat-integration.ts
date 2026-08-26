import { useMutation, useQueryClient } from "@tanstack/react-query";
import createGoogleChatIntegration, {
  type CreateGoogleChatIntegrationRequest,
} from "@/fetchers/google-chat-integration/create-google-chat-integration";
import deleteGoogleChatIntegration from "@/fetchers/google-chat-integration/delete-google-chat-integration";
import updateGoogleChatIntegration, {
  type UpdateGoogleChatIntegrationRequest,
} from "@/fetchers/google-chat-integration/update-google-chat-integration";

export function useCreateGoogleChatIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: CreateGoogleChatIntegrationRequest;
    }) => createGoogleChatIntegration(projectId, data),
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["google-chat-integration", projectId],
      });
    },
  });
}

export function useUpdateGoogleChatIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      json,
    }: {
      projectId: string;
      json: UpdateGoogleChatIntegrationRequest;
    }) => updateGoogleChatIntegration(projectId, json),
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["google-chat-integration", projectId],
      });
    },
  });
}

export function useDeleteGoogleChatIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deleteGoogleChatIntegration(projectId),
    onSuccess: (_, projectId) => {
      void queryClient.invalidateQueries({
        queryKey: ["google-chat-integration", projectId],
      });
    },
  });
}

import { verifyGiteaRepository } from "@/fetchers/gitea-integration/verify-gitea-repository";
import type { VerifyGiteaRepositoryRequest } from "@/fetchers/gitea-integration/verify-gitea-repository";
import { client } from "@kaneo/libs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono";

export type CreateGiteaIntegrationRequest = InferRequestType<
  (typeof client)["gitea-integration"]["project"][":projectId"]["$post"]
>["json"];

export type CreateGiteaIntegrationResponse = InferResponseType<
  (typeof client)["gitea-integration"]["project"][":projectId"]["$post"]
>;

async function createGiteaIntegration(
  projectId: string,
  data: CreateGiteaIntegrationRequest,
): Promise<CreateGiteaIntegrationResponse> {
  const response = await client["gitea-integration"].project[
    ":projectId"
  ].$post({
    param: { projectId },
    json: data,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

async function deleteGiteaIntegration(projectId: string) {
  const response = await client["gitea-integration"].project[
    ":projectId"
  ].$delete({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export function useCreateGiteaIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: CreateGiteaIntegrationRequest;
    }) => createGiteaIntegration(projectId, data),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: ["gitea-integration", projectId],
      });
    },
  });
}

export function useDeleteGiteaIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteGiteaIntegration,
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({
        queryKey: ["gitea-integration", projectId],
      });
    },
  });
}

export function useVerifyGiteaRepository() {
  return useMutation({
    mutationFn: (data: VerifyGiteaRepositoryRequest) =>
      verifyGiteaRepository(data),
  });
}

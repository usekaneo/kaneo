import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;
export type CreateGithubIntegrationRequest =
  RouterInput["githubIntegration"]["create"];

async function createGithubIntegration(
  projectId: string,
  data: Omit<CreateGithubIntegrationRequest, "projectId">,
) {
  const input: CreateGithubIntegrationRequest = {
    projectId,
    ...data,
  };

  return await trpcClient.githubIntegration.create.mutate(input);
}

export default createGithubIntegration;

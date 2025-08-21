import { trpcClient } from "@/utils/trpc";

async function deleteGithubIntegration(projectId: string) {
  return await trpcClient.githubIntegration.delete.mutate({ projectId });
}

export default deleteGithubIntegration;

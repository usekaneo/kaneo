import { trpcClient } from "@/utils/trpc";

async function getGithubIntegration(projectId: string) {
  return await trpcClient.githubIntegration.get.query({ projectId });
}

export default getGithubIntegration;

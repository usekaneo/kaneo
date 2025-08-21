import { trpcClient } from "@/utils/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterOutput = inferRouterOutputs<AppRouter>;
export type ListRepositoriesResponse =
  RouterOutput["githubIntegration"]["listRepositories"];

async function listRepositories(): Promise<ListRepositoriesResponse> {
  return await trpcClient.githubIntegration.listRepositories.query();
}

export default listRepositories;

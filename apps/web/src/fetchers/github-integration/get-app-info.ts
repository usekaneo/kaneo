import { trpcClient } from "@/utils/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterOutput = inferRouterOutputs<AppRouter>;
export type GitHubAppInfo = RouterOutput["githubIntegration"]["getAppInfo"];

export default async function getGitHubAppInfo(): Promise<GitHubAppInfo> {
  return await trpcClient.githubIntegration.getAppInfo.query();
}

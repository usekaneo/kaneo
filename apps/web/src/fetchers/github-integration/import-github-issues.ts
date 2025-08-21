import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;
export type ImportGithubIssuesRequest =
  RouterInput["githubIntegration"]["importIssues"];

async function importGithubIssues(data: ImportGithubIssuesRequest) {
  return await trpcClient.githubIntegration.importIssues.mutate(data);
}

export default importGithubIssues;

import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;
type RouterOutput = inferRouterOutputs<AppRouter>;

export type VerifyGithubInstallationRequest =
  RouterInput["githubIntegration"]["verifyInstallation"];
export type VerifyGithubInstallationResponse =
  RouterOutput["githubIntegration"]["verifyInstallation"];

async function verifyGithubInstallation(
  data: VerifyGithubInstallationRequest,
): Promise<VerifyGithubInstallationResponse> {
  return await trpcClient.githubIntegration.verifyInstallation.query(data);
}

export default verifyGithubInstallation;

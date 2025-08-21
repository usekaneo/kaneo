import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;
export type GetProjectRequest = RouterInput["project"]["get"];

async function getProject(input: GetProjectRequest) {
  return await trpcClient.project.get.query(input);
}

export default getProject;

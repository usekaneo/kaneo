import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;
export type CreateProjectRequest = RouterInput["project"]["create"];

async function createProject(input: CreateProjectRequest) {
  return await trpcClient.project.create.mutate(input);
}

export default createProject;

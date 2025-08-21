import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;
export type DeleteProjectRequest = RouterInput["project"]["delete"];

async function deleteProject(input: DeleteProjectRequest) {
  return await trpcClient.project.delete.mutate(input);
}

export default deleteProject;

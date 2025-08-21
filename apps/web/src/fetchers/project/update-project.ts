import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;
export type UpdateProjectRequest = RouterInput["project"]["update"];

async function updateProject(input: UpdateProjectRequest) {
  return await trpcClient.project.update.mutate(input);
}

export default updateProject;

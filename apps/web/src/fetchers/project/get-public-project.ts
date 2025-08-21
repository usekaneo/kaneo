import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;
export type GetPublicProjectRequest = RouterInput["project"]["getPublic"];

async function getPublicProject(input: GetPublicProjectRequest) {
  return await trpcClient.project.getPublic.query(input);
}

export default getPublicProject;

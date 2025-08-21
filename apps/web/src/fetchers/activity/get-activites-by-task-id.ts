import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;
export type GetActivitesByTaskIdRequest =
  RouterInput["activity"]["getByTaskId"];

async function getActivitesByTaskId(input: GetActivitesByTaskIdRequest) {
  return await trpcClient.activity.getByTaskId.query(input);
}

export default getActivitesByTaskId;

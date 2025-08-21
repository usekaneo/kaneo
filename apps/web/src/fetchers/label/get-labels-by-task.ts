import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;
export type GetLabelsByTaskRequest = RouterInput["label"]["getByTaskId"];

async function getLabelsByTask(input: GetLabelsByTaskRequest) {
  return await trpcClient.label.getByTaskId.query(input);
}

export default getLabelsByTask;

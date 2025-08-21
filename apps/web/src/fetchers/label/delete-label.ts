import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;
export type DeleteLabelRequest = RouterInput["label"]["delete"];

async function deleteLabel(input: DeleteLabelRequest) {
  return await trpcClient.label.delete.mutate(input);
}

export default deleteLabel;

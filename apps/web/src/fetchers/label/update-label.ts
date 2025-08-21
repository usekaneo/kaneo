import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;
export type UpdateLabelRequest = RouterInput["label"]["update"];

async function updateLabel(input: UpdateLabelRequest) {
  return await trpcClient.label.update.mutate(input);
}

export default updateLabel;

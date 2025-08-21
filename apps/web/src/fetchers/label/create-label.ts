import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;
export type CreateLabelRequest = RouterInput["label"]["create"];

async function createLabel(input: CreateLabelRequest) {
  return await trpcClient.label.create.mutate(input);
}

export default createLabel;

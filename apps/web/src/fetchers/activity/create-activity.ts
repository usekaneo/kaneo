import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;
export type CreateActivityRequest = RouterInput["activity"]["createComment"];

async function createActivity(input: CreateActivityRequest) {
  return await trpcClient.activity.createComment.mutate(input);
}

export default createActivity;

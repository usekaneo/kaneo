import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;
export type CreateCommentRequest = RouterInput["activity"]["createComment"];

async function createComment(input: CreateCommentRequest) {
  return await trpcClient.activity.createComment.mutate(input);
}

export default createComment;

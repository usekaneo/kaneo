import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;
export type UpdateCommentRequest = RouterInput["activity"]["updateComment"];

async function updateComment(input: UpdateCommentRequest) {
  return await trpcClient.activity.updateComment.mutate(input);
}

export default updateComment;

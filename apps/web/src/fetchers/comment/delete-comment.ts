import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;
export type DeleteCommentRequest = RouterInput["activity"]["deleteComment"];

async function deleteComment(input: DeleteCommentRequest) {
  return await trpcClient.activity.deleteComment.mutate(input);
}

export default deleteComment;

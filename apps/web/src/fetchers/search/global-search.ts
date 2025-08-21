import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;

type SearchParams = {
  q: string;
  type?:
    | "all"
    | "tasks"
    | "projects"
    | "workspaces"
    | "comments"
    | "activities";
  workspaceId?: string;
  projectId?: string;
  limit?: number;
};

async function globalSearch(params: SearchParams) {
  // Map the q parameter to query for tRPC
  const { q, ...rest } = params;
  const input: RouterInput["search"]["global"] = { query: q, ...rest };

  return await trpcClient.search.global.query(input);
}

export default globalSearch;

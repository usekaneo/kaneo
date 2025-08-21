import { trpcClient } from "@/utils/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterOutput = inferRouterOutputs<AppRouter>;
export type GetConfigResponse = RouterOutput["config"];

export async function getConfig() {
  return await trpcClient.config.query();
}

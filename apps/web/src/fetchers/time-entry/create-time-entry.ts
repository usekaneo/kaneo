import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;
export type CreateTimeEntryRequest = RouterInput["timeEntry"]["create"];

async function createTimeEntry(input: CreateTimeEntryRequest) {
  return await trpcClient.timeEntry.create.mutate(input);
}

export default createTimeEntry;

import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;
export type UpdateTimeEntryRequest = RouterInput["timeEntry"]["update"];

async function updateTimeEntry(input: UpdateTimeEntryRequest) {
  return await trpcClient.timeEntry.update.mutate(input);
}

export default updateTimeEntry;

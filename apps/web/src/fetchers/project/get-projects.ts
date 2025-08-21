import { trpcClient } from "@/utils/trpc";

export async function getProjects() {
  return await trpcClient.project.list.query();
}

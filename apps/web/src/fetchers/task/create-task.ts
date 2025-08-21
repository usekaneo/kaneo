import { trpcClient } from "@/utils/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../api/src/routers";

type RouterInput = inferRouterInputs<AppRouter>;
export type CreateTaskRequest = RouterInput["task"]["create"];

async function createTask(
  title: string,
  description: string,
  projectId: string,
  userId: string,
  status: string,
  dueDate: Date | undefined,
  priority: string,
) {
  const input: CreateTaskRequest = {
    title,
    description,
    projectId,
    userId,
    status,
    dueDate,
    priority,
  };

  return await trpcClient.task.create.mutate(input);
}

export default createTask;

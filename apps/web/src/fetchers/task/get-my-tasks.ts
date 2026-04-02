import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

type GetMyTasksRequest = InferRequestType<
  (typeof client)["task"]["tasks"]["workspace"][":workspaceId"]["my"]["$get"]
>["param"];

async function getMyTasks({ workspaceId }: GetMyTasksRequest) {
  const response = await client.task.tasks.workspace[":workspaceId"].my.$get({
    param: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getMyTasks;

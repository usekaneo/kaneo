import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type GetActivitesByTaskIdRequest = InferRequestType<
  (typeof client)["activity"][":taskId"]["$get"]
>["param"];

async function getActivitesByTaskId({ taskId }: GetActivitesByTaskIdRequest) {
  const response = await client.activity[":taskId"].$get({
    param: { taskId },
  });

  const data = await response.json();

  return data;
}

export default getActivitesByTaskId;

import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type GetActivitesByTaskIdRequest = InferRequestType<
  (typeof client)["activity"][":taskId"]["$get"]
>["param"];

async function getActivitesByTaskId({ taskId }: GetActivitesByTaskIdRequest) {
  const response = await client.activity[":taskId"].$get({
    param: { taskId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default getActivitesByTaskId;

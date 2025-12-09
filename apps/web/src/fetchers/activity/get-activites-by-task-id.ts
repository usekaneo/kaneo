import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type GetActivitesByTaskIdRequest = InferRequestType<
  (typeof client)["activity"][":taskId"]["$get"]
>["param"];

async function getActivitesByTaskId({ taskId }: GetActivitesByTaskIdRequest) {
  const response = await client.activity[":taskId"].$get({
    param: { taskId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  data.forEach((x) => {
    if (x?.content) {
      x.content = x.content.replace(/\n+/g, "\n");
    }
  });

  return data;
}

export default getActivitesByTaskId;

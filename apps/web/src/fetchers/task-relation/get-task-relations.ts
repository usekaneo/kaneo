import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getTaskRelations(taskId: string) {
  const response = await client["task-relation"][":taskId"].$get({
    param: { taskId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();

  return data;
}

export default getTaskRelations;

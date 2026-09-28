import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getTimeEntriesByTaskId(taskId: string) {
  const response = await client["time-entry"].task[":taskId"].$get({
    param: { taskId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();
  return data;
}

export default getTimeEntriesByTaskId;

import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getCustomFieldValuesByTask({ taskId }: { taskId: string }) {
  const response = await client["custom-field"].task[":taskId"].$get({
    param: { taskId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default getCustomFieldValuesByTask;

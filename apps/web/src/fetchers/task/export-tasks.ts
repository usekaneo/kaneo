import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function exportTasks(projectId: string) {
  const response = await client.task.export[":projectId"].$get({
    param: { projectId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();
  return data;
}

export default exportTasks;

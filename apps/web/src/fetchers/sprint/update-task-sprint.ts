import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function updateTaskSprint(taskId: string, sprintId: string | null) {
  const response = await client.sprint.task[":taskId"].$put({
    param: { taskId },
    json: { sprintId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default updateTaskSprint;

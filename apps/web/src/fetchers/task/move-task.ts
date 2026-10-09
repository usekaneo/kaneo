import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function moveTask({
  taskId,
  destinationProjectId,
  destinationStatus,
}: {
  taskId: string;
  destinationProjectId: string;
  destinationStatus?: string;
}) {
  const response = await client.task.move[":id"].$put({
    param: { id: taskId },
    json: {
      destinationProjectId,
      destinationStatus,
    },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default moveTask;

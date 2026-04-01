import { client } from "@kaneo/libs";

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
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default moveTask;

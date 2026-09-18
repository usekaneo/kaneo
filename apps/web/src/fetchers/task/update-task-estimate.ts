import { client } from "@kaneo/libs";

async function updateTaskEstimate(
  taskId: string,
  estimateMinutes: number | null,
) {
  const response = await client.task.estimate[":id"].$put({
    param: { id: taskId },
    json: { estimateMinutes },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default updateTaskEstimate;

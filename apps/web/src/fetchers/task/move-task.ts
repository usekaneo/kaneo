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
    let message: string;
    try {
      const json = await response.json();
      message =
        (json as { message?: string; error?: string }).message ||
        (json as { error?: string }).error ||
        JSON.stringify(json);
    } catch {
      message = (await response.text().catch(() => "")) || `API error ${response.status}`;
    }
    throw new Error(message);
  }

  return response.json();
}

export default moveTask;

import { client } from "@kaneo/libs";

async function duplicateTask({
  taskId,
  title,
}: {
  taskId: string;
  title?: string;
}) {
  const response = await client.task.duplicate[":id"].$post({
    param: { id: taskId },
    json: { title },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default duplicateTask;

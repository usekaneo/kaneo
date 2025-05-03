import { client } from "@kaneo/libs";

async function getTasks(projectId: string) {
  const response = await client.task.tasks[":projectId"].$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default getTasks;

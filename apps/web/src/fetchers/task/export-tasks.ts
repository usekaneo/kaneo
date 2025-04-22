import { client } from "@kaneo/libs";

async function exportTasks(projectId: string) {
  const response = await client.task.export[":projectId"].$get({
    param: { projectId },
  });

  const data = await response.json();
  return data;
}

export default exportTasks;

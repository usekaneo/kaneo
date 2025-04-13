import { client } from "@kaneo/libs";

async function getTasks(projectId: string) {
  const response = await client.task.tasks[":projectId"].$get({
    param: { projectId },
  });

  const data = await response.json();

  return data;
}

export default getTasks;

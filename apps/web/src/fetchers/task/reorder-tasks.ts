import { client } from "@kaneo/libs";

export type TaskReorderInput = {
  id: string;
  status: string;
  position: number;
};

async function reorderTasks(projectId: string, tasks: TaskReorderInput[]) {
  const response = await client.task.reorder[":projectId"].$put({
    param: { projectId },
    json: { tasks },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default reorderTasks;

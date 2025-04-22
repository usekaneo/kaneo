import { client } from "@kaneo/libs";

export type TaskToImport = {
  title: string;
  description?: string;
  status: string;
  priority?: string;
  dueDate?: string;
  userEmail?: string | null;
};

async function importTasks(projectId: string, tasks: TaskToImport[]) {
  const response = await client.task.import[":projectId"].$post({
    param: { projectId },
    json: { tasks },
  });

  const data = await response.json();
  return data;
}

export default importTasks;

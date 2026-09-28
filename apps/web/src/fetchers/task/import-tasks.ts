import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";
export type TaskToImport = {
  title: string;
  description?: string;
  status: string;
  priority?: string;
  startDate?: string;
  dueDate?: string;
  userId?: string | null;
};

async function importTasks(projectId: string, tasks: TaskToImport[]) {
  const response = await client.task.import[":projectId"].$post({
    param: { projectId },
    json: { tasks },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();
  return data;
}

export default importTasks;

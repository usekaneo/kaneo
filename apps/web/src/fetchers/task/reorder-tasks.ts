import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export type TaskReorder = {
  projectId: string;
  tasks: { id: string; position: number; status?: string }[];
};
export default async function reorderTasks(json: TaskReorder) {
  const response = await client.task.reorder.$post({ json });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}

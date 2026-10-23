import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function getSubtaskStatusPreview(taskId: string, status: string) {
  const response = await client.task["subtask-status"][":id"].$get({
    param: { id: taskId },
    query: { status },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function updateSubtaskStatuses(
  taskId: string,
  status: string,
  taskIds: string[],
) {
  const response = await client.task["subtask-status"][":id"].$put({
    param: { id: taskId },
    json: { status, taskIds },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export type SubtaskStatusPreview = Awaited<
  ReturnType<typeof getSubtaskStatusPreview>
>;

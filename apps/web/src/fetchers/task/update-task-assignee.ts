import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type Task from "@/types/task";

type UpdateTaskAssigneePayload = Pick<Task, "userId"> & {
  /**
   * The complete set of assignees. Deliberately not named `assigneeIds`: callers
   * spread a whole task into this payload, and a task already carries its own
   * `assigneeIds`, which must never override the `userId` they set.
   */
  replaceAssigneeIds?: string[];
};

async function updateTaskAssignee(
  taskId: string,
  task: UpdateTaskAssigneePayload,
) {
  const response = await client.task.assignee[":id"].$put({
    param: { id: taskId },
    json: task.replaceAssigneeIds
      ? { assigneeIds: task.replaceAssigneeIds }
      : { userId: task.userId || "" },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();

  return data;
}

export default updateTaskAssignee;

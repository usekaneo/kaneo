import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type Task from "@/types/task";

type UpdateTaskAssigneePayload = Pick<Task, "userId"> & {
  assigneeMode?: "set" | "add" | "remove";
  assigneeIds?: string[];
};

async function updateTaskAssignee(
  taskId: string,
  task: UpdateTaskAssigneePayload,
) {
  const response =
    task.assigneeMode === "add"
      ? await client.task[":id"].assignees.$post({
          param: { id: taskId },
          json: { userId: task.userId! },
        })
      : task.assigneeMode === "remove"
        ? await client.task[":id"].assignees[":userId"].$delete({
            param: { id: taskId, userId: task.userId! },
          })
        : task.assigneeMode === "set"
          ? await client.task[":id"].assignees.$put({
              param: { id: taskId },
              json: { assigneeIds: task.assigneeIds ?? [] },
            })
          : await client.task.assignee[":id"].$put({
              param: { id: taskId },
              json: {
                userId: task.userId || "",
              },
            });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();

  return data;
}

export default updateTaskAssignee;

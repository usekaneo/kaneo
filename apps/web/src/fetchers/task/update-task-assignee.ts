import { client } from "@kaneo/libs";

type UpdateTaskAssigneePayload = {
  userId?: string | null;
  assigneeIds?: string[];
};

async function updateTaskAssignee(
  taskId: string,
  task: UpdateTaskAssigneePayload,
) {
  const response = await client.task.assignee[":id"].$put({
    param: { id: taskId },
    json: {
      userId: task.userId ?? null,
      assigneeIds: task.assigneeIds,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default updateTaskAssignee;

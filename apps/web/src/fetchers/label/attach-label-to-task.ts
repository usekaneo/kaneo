import { client } from "@kaneo/libs";

export type AttachLabelToTaskRequest = {
  labelId: string;
  taskId: string;
};

async function attachLabelToTask({
  labelId,
  taskId,
}: AttachLabelToTaskRequest) {
  const response = await client.label[":id"].task.$put({
    param: { id: labelId },
    json: { taskId },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default attachLabelToTask;

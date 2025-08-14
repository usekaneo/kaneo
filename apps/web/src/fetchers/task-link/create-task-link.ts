import type { TaskLinkType } from "@/types/task-link";
import { client } from "@kaneo/libs";

async function createTaskLink(
  taskId: string,
  targetTaskId: string,
  type: TaskLinkType = "relates_to",
) {
  // biome-ignore lint/suspicious/noExplicitAny: task-link route not typed
  const response = await (client as any)["task-link"][":taskId"].$post({
    param: { taskId },
    json: { targetTaskId, type },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default createTaskLink;

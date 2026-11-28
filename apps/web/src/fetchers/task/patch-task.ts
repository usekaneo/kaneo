import { client } from "@kaneo/libs";
import type { TaskChanges } from "@kaneo/plugin-sdk/web";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

type TaskPatch = InferRequestType<
  (typeof client)["task"][":id"]["$patch"]
>["json"];

export async function patchTask(taskId: string, changes: TaskChanges) {
  const { assigneeId, priority, ...fields } = changes;
  const response = await client.task[":id"].$patch({
    param: { id: taskId },
    json: {
      ...fields,
      userId: assigneeId,
      priority: priority as TaskPatch["priority"],
    },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

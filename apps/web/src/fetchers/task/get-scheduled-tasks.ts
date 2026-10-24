import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type ScheduledTasks = InferResponseType<
  (typeof client)["task"]["scheduled"]["$get"],
  200
>;

export type ScheduledTask = ScheduledTasks["tasks"][number];

export type GetScheduledTasksQuery = {
  workspaceId: string;
  from: string;
  to: string;
  assignedToMe?: boolean;
};

async function getScheduledTasks({
  workspaceId,
  from,
  to,
  assignedToMe,
}: GetScheduledTasksQuery) {
  const response = await client.task.scheduled.$get({
    query: {
      workspaceId,
      from,
      to,
      ...(assignedToMe ? { assignedToMe: "true" as const } : {}),
    },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getScheduledTasks;

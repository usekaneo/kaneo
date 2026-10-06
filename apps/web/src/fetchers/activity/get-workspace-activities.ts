import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type WorkspaceActivity = InferResponseType<
  (typeof client)["activity"]["workspace"][":workspaceId"]["$get"],
  200
>[number];

async function getWorkspaceActivities(workspaceId: string) {
  const response = await client.activity.workspace[":workspaceId"].$get({
    param: { workspaceId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default getWorkspaceActivities;

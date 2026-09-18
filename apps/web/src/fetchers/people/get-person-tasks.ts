import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type PersonTask = InferResponseType<
  (typeof client)["people"][":userId"]["tasks"]["$get"],
  200
>[number];

async function getPersonTasks(workspaceId: string, userId: string) {
  const response = await client.people[":userId"].tasks.$get({
    param: { userId },
    query: { workspaceId },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default getPersonTasks;

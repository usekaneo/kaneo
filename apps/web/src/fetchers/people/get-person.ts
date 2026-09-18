import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type PersonDetail = InferResponseType<
  (typeof client)["people"][":userId"]["$get"],
  200
>;

async function getPerson(workspaceId: string, userId: string) {
  const response = await client.people[":userId"].$get({
    param: { userId },
    query: { workspaceId },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default getPerson;

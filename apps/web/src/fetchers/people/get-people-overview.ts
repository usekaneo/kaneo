import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type PeopleOverview = InferResponseType<
  (typeof client)["people"]["overview"]["$get"],
  200
>;
export type PersonStats = PeopleOverview["people"][number];

async function getPeopleOverview(workspaceId: string) {
  const response = await client.people.overview.$get({
    query: { workspaceId },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default getPeopleOverview;

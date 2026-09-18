import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type Person = InferResponseType<
  (typeof client)["people"]["$get"],
  200
>[number];

async function listPeople(workspaceId: string) {
  const response = await client.people.$get({ query: { workspaceId } });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default listPeople;

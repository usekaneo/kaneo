import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

type Endpoint = (typeof client)["task"]["global-board"]["$get"];

export type GlobalBoardTasksQuery = InferRequestType<Endpoint>["query"];

export type GlobalBoardTasksPage = InferResponseType<Endpoint, 200>;

export type GlobalBoardTask = GlobalBoardTasksPage["tasks"][number];

async function getGlobalBoardTasks(query: GlobalBoardTasksQuery) {
  const response = await client.task["global-board"].$get({ query });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getGlobalBoardTasks;

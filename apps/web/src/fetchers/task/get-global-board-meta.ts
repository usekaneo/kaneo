import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type GlobalBoardMeta = InferResponseType<
  (typeof client)["task"]["global-board"]["meta"]["$get"],
  200
>;

export type GlobalBoardProject = GlobalBoardMeta["projects"][number];

async function getGlobalBoardMeta() {
  const response = await client.task["global-board"].meta.$get();

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getGlobalBoardMeta;

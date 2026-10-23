import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type MoveGlobalBoardTaskRequest = InferRequestType<
  (typeof client)["task"]["global-board"]["move"]["$post"]
>["json"];

async function moveGlobalBoardTask(json: MoveGlobalBoardTaskRequest) {
  const response = await client.task["global-board"].move.$post({ json });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default moveGlobalBoardTask;

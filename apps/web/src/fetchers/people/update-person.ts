import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type UpdatePersonRequest = InferRequestType<
  (typeof client)["people"][":userId"]["$put"]
>["json"];

async function updatePerson(userId: string, json: UpdatePersonRequest) {
  const response = await client.people[":userId"].$put({
    param: { userId },
    json,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default updatePerson;

import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type Habit = InferResponseType<
  (typeof client)["habit"]["$get"],
  200
>[number];

async function getHabits(range: { from: string; to: string }) {
  const response = await client.habit.$get({ query: range });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getHabits;

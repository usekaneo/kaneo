import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";

export type UpsertSavedViewRequest = InferRequestType<
  (typeof client)["saved-view"]["$post"]
>["json"];

async function upsertSavedView(input: UpsertSavedViewRequest) {
  const response = await client["saved-view"].$post({ json: input });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default upsertSavedView;

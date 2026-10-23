import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type PinnedLabel = InferResponseType<
  (typeof client)["label"]["pinned"]["$get"],
  200
>[number];

async function getPinnedLabels() {
  const response = await client.label.pinned.$get();

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getPinnedLabels;

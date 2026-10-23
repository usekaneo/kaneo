import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type ProjectDefaultLabel = InferResponseType<
  (typeof client)["label"]["project"][":projectId"]["defaults"]["$get"],
  200
>[number];

async function getProjectDefaultLabels(projectId: string) {
  const response = await client.label.project[":projectId"].defaults.$get({
    param: { projectId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getProjectDefaultLabels;

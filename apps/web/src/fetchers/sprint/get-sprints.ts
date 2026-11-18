import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";
import type Sprint from "@/types/sprint";

async function getSprints(projectId: string) {
  const response = await client.sprint[":projectId"].$get({
    param: { projectId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return (await response.json()) as Sprint[];
}

export default getSprints;

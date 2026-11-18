import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";
import type Sprint from "@/types/sprint";

async function reorderSprints(
  projectId: string,
  sprints: Array<{ id: string; position: number }>,
) {
  const response = await client.sprint.reorder[":projectId"].$post({
    param: { projectId },
    json: { sprints },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return (await response.json()) as Sprint[];
}

export default reorderSprints;

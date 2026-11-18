import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";
import type { CloseSprintResult } from "@/types/sprint";

async function closeSprint(id: string, targetSprintId: string | null) {
  const response = await client.sprint.close[":id"].$post({
    param: { id },
    json: { targetSprintId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return (await response.json()) as CloseSprintResult;
}

export default closeSprint;

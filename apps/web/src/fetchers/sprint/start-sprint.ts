import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";
import type Sprint from "@/types/sprint";

async function startSprint(
  id: string,
  data?: { startDate?: string; endDate?: string },
) {
  const response = await client.sprint.start[":id"].$post({
    param: { id },
    json: data ?? {},
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return (await response.json()) as Sprint;
}

export default startSprint;

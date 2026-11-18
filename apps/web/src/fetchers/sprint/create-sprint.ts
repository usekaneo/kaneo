import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";
import type Sprint from "@/types/sprint";

async function createSprint(
  projectId: string,
  data: {
    name?: string;
    goal?: string | null;
    startDate?: string;
    endDate?: string;
  },
) {
  const response = await client.sprint[":projectId"].$post({
    param: { projectId },
    json: data,
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return (await response.json()) as Sprint;
}

export default createSprint;

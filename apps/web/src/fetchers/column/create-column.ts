import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function createColumn(
  projectId: string,
  data: { name: string; icon?: string; color?: string; isFinal?: boolean },
) {
  const response = await client.column[":projectId"].$post({
    param: { projectId },
    json: data,
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default createColumn;

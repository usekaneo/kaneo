import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function reorderColumns(
  projectId: string,
  columns: Array<{ id: string; position: number }>,
) {
  const response = await client.column.reorder[":projectId"].$put({
    param: { projectId },
    json: { columns },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default reorderColumns;

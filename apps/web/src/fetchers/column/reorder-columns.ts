import { client } from "@kaneo/libs";

async function reorderColumns(
  projectId: string,
  columns: Array<{ id: string; position: number }>,
) {
  const response = await client.column.reorder[":projectId"].$put({
    param: { projectId },
    json: { columns },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default reorderColumns;

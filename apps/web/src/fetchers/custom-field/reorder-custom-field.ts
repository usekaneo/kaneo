import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function reorderCustomFields(
  projectId: string,
  fields: Array<{ id: string; position: number }>,
) {
  const response = await client["custom-field"].reorder[":projectId"].$put({
    param: { projectId },
    json: { fields },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default reorderCustomFields;

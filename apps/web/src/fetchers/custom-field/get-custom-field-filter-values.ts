import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getCustomFieldFilterValues({
  projectId,
}: {
  projectId: string;
}) {
  const response = await client["custom-field"].project[":projectId"][
    "filter-values"
  ].$get({
    param: { projectId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default getCustomFieldFilterValues;

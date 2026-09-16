import { client } from "@kaneo/libs";

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
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getCustomFieldFilterValues;

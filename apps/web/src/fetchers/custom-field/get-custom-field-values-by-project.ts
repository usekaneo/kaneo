import { client } from "@kaneo/libs";

async function getCustomFieldValuesByProject({
  projectId,
}: {
  projectId: string;
}) {
  const response = await client["custom-field"].project[
    ":projectId"
  ].values.$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getCustomFieldValuesByProject;

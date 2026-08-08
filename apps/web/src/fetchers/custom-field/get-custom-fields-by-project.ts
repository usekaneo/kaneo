import { client } from "@kaneo/libs";

async function getCustomFieldsByProject({ projectId }: { projectId: string }) {
  const response = await client["custom-field"].project[":projectId"].$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getCustomFieldsByProject;
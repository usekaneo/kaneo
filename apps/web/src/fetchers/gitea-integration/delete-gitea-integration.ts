import { client } from "@kaneo/libs";

async function deleteGiteaIntegration(projectId: string) {
  const response = await client["gitea-integration"].project[
    ":projectId"
  ].$delete({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default deleteGiteaIntegration;

import { client } from "@kaneo/libs";

async function deleteGithubIntegration(projectId: string) {
  const response = await client["github-integration"].project[
    ":projectId"
  ].$delete({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const result = await response.json();
  return result;
}

export default deleteGithubIntegration;

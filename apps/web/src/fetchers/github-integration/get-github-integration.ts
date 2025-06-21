import { client } from "@kaneo/libs";

async function getGithubIntegration(projectId: string) {
  const response = await client["github-integration"].project[
    ":projectId"
  ].$get({
    param: { projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();
  return data;
}

export default getGithubIntegration;

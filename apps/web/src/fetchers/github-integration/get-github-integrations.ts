import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getGithubIntegrations(projectId: string) {
  const response = await client["github-integration"].project[
    ":projectId"
  ].integrations.$get({
    param: { projectId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();
  return data;
}

export type GithubIntegration = Awaited<
  ReturnType<typeof getGithubIntegrations>
>["integrations"][number];

export default getGithubIntegrations;

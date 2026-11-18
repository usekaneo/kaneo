import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getGitlabIntegrations(projectId: string) {
  const response = await client["gitlab-integration"].project[
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

export type GitlabIntegration = Awaited<
  ReturnType<typeof getGitlabIntegrations>
>["integrations"][number];

export default getGitlabIntegrations;

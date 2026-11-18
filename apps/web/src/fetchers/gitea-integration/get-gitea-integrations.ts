import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getGiteaIntegrations(projectId: string) {
  const response = await client["gitea-integration"].project[
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

export type GiteaIntegration = Awaited<
  ReturnType<typeof getGiteaIntegrations>
>["integrations"][number];

export default getGiteaIntegrations;

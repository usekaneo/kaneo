import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getGiteaIntegration(projectId: string) {
  const response = await client["gitea-integration"].project[":projectId"].$get(
    {
      param: { projectId },
    },
  );

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();
  return data;
}

export default getGiteaIntegration;

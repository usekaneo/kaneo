import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getGiteaIntegration(projectId: string) {
  const response = await client["gitea-integration"].project[":projectId"].$get(
    {
      param: { projectId },
    },
  );

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();
  return data;
}

export default getGiteaIntegration;

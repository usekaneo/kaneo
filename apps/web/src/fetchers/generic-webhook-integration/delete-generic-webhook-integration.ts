import { getApiUrl } from "@/fetchers/get-api-url";

import { HttpError } from "@/lib/http-error";

async function deleteGenericWebhookIntegration(projectId: string) {
  const response = await fetch(
    getApiUrl(`/generic-webhook-integration/project/${projectId}`),
    {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default deleteGenericWebhookIntegration;

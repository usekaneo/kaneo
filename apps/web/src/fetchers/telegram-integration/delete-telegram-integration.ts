import { getApiUrl } from "@/fetchers/get-api-url";

import { HttpError } from "@/lib/http-error";

async function deleteTelegramIntegration(projectId: string) {
  const response = await fetch(
    getApiUrl(`/telegram-integration/project/${projectId}`),
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return (await response.json()) as { success: boolean };
}

export default deleteTelegramIntegration;

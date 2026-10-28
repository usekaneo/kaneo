import { getApiUrl } from "@/fetchers/get-api-url";

import { HttpError } from "@/lib/http-error";

async function deleteDiscordIntegration(projectId: string) {
  const response = await fetch(
    getApiUrl(`/discord-integration/project/${projectId}`),
    {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default deleteDiscordIntegration;

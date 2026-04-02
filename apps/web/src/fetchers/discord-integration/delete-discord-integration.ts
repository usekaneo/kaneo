import { getApiUrl } from "@/fetchers/get-api-url";

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
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default deleteDiscordIntegration;

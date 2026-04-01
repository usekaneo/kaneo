import { getApiUrl } from "@/fetchers/get-api-url";

async function deleteTelegramIntegration(projectId: string) {
  const response = await fetch(
    getApiUrl(`/telegram-integration/project/${projectId}`),
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return (await response.json()) as { success: boolean };
}

export default deleteTelegramIntegration;

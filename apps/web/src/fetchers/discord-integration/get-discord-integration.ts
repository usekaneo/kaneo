export type DiscordIntegration = {
  id: string;
  projectId: string;
  channelName: string | null;
  webhookConfigured: boolean;
  webhookUrl: string;
  events: {
    taskCreated: boolean;
    taskStatusChanged: boolean;
    taskPriorityChanged: boolean;
    taskTitleChanged: boolean;
    taskDescriptionChanged: boolean;
    taskCommentCreated: boolean;
  };
  isActive: boolean | null;
  createdAt: string;
  updatedAt: string;
} | null;

function getApiUrl(path: string) {
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:1337";
  const apiUrl = baseUrl.endsWith("/api") ? baseUrl : `${baseUrl}/api`;
  return `${apiUrl}${path}`;
}

async function getDiscordIntegration(projectId: string) {
  const response = await fetch(
    getApiUrl(`/discord-integration/project/${projectId}`),
    {
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

  return (await response.json()) as DiscordIntegration;
}

export default getDiscordIntegration;

import { getApiUrl } from "@/fetchers/get-api-url";

export type TelegramIntegration = {
  id: string;
  projectId: string;
  chatId: string;
  threadId: number | null;
  chatLabel: string | null;
  botTokenConfigured: boolean;
  maskedBotToken: string;
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

async function getTelegramIntegration(projectId: string) {
  const response = await fetch(
    getApiUrl(`/telegram-integration/project/${projectId}`),
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return (await response.json()) as TelegramIntegration;
}

export default getTelegramIntegration;

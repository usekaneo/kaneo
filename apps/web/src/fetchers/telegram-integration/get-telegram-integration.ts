import { getApiUrl } from "@/fetchers/get-api-url";

import { HttpError } from "@/lib/http-error";
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

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return (await response.json()) as TelegramIntegration;
}

export default getTelegramIntegration;

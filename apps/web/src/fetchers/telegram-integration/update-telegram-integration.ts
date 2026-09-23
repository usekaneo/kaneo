import { getApiUrl } from "@/fetchers/get-api-url";
import { HttpError } from "@/lib/http-error";
import type { TelegramIntegration } from "./get-telegram-integration";

export type UpdateTelegramIntegrationRequest = {
  botToken?: string;
  chatId?: string;
  threadId?: number | null;
  chatLabel?: string | null;
  isActive?: boolean;
  events?: {
    taskCreated?: boolean;
    taskStatusChanged?: boolean;
    taskPriorityChanged?: boolean;
    taskTitleChanged?: boolean;
    taskDescriptionChanged?: boolean;
    taskCommentCreated?: boolean;
  };
};

async function updateTelegramIntegration(
  projectId: string,
  json: UpdateTelegramIntegrationRequest,
) {
  const response = await fetch(
    getApiUrl(`/telegram-integration/project/${projectId}`),
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(json),
    },
  );

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return (await response.json()) as TelegramIntegration;
}

export default updateTelegramIntegration;

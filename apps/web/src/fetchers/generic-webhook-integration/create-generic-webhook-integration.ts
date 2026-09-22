import { getApiUrl } from "@/fetchers/get-api-url";
import { HttpError } from "@/lib/http-error";
import type { GenericWebhookIntegration } from "./get-generic-webhook-integration";

export type CreateGenericWebhookIntegrationRequest = {
  webhookUrl: string;
  secret?: string;
  events?: {
    taskCreated?: boolean;
    taskStatusChanged?: boolean;
    taskPriorityChanged?: boolean;
    taskTitleChanged?: boolean;
    taskDescriptionChanged?: boolean;
    taskCommentCreated?: boolean;
    taskDeleted?: boolean;
    taskMoved?: boolean;
    taskDueDateChanged?: boolean;
    taskAssigneeChanged?: boolean;
    taskUnassigned?: boolean;
    dueDateReminder?: boolean;
  };
  dueDateReminderLeadTimeMinutes?: number;
};

async function createGenericWebhookIntegration(
  projectId: string,
  json: CreateGenericWebhookIntegrationRequest,
) {
  const response = await fetch(
    getApiUrl(`/generic-webhook-integration/project/${projectId}`),
    {
      method: "POST",
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

  return (await response.json()) as GenericWebhookIntegration;
}

export default createGenericWebhookIntegration;

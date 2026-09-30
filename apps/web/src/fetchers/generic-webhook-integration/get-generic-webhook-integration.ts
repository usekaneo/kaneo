import { getApiUrl } from "@/fetchers/get-api-url";

import { HttpError } from "@/lib/http-error";
export type GenericWebhookIntegration = {
  id: string;
  projectId: string;
  webhookConfigured: boolean;
  maskedWebhookUrl: string | null;
  secretConfigured: boolean;
  maskedSecret: string | null;
  events: {
    taskCreated: boolean;
    taskStatusChanged: boolean;
    taskPriorityChanged: boolean;
    taskTitleChanged: boolean;
    taskDescriptionChanged: boolean;
    taskCommentCreated: boolean;
    taskDeleted: boolean;
    taskMoved: boolean;
    taskDueDateChanged: boolean;
    taskAssigneeChanged: boolean;
    taskUnassigned: boolean;
    dueDateReminder: boolean;
  };
  dueDateReminderLeadTimeMinutes: number;
  isActive: boolean | null;
  createdAt: string;
  updatedAt: string;
};

async function getGenericWebhookIntegration(
  projectId: string,
): Promise<GenericWebhookIntegration | null> {
  const response = await fetch(
    getApiUrl(`/generic-webhook-integration/project/${projectId}`),
    {
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return (await response.json()) as GenericWebhookIntegration | null;
}

export default getGenericWebhookIntegration;

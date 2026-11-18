import { z } from "../openapi";

export const integrationEventsSchema = z
  .object({
    taskCreated: z.boolean(),
    taskStatusChanged: z.boolean(),
    taskPriorityChanged: z.boolean(),
    taskTitleChanged: z.boolean(),
    taskDescriptionChanged: z.boolean(),
    taskCommentCreated: z.boolean(),
  })
  .openapi("IntegrationEvents");

export const genericWebhookEventsSchema = integrationEventsSchema
  .extend({
    taskDeleted: z.boolean(),
    taskMoved: z.boolean(),
    taskDueDateChanged: z.boolean(),
    taskAssigneeChanged: z.boolean(),
    taskUnassigned: z.boolean(),
    dueDateReminder: z.boolean(),
  })
  .openapi("GenericWebhookEvents");

// RFC 0001 WP10: repository binding usage summary returned by the provider
// list endpoints so the UI can show "N of M repositories linked" without a
// second call. `limit` is null when the plan is unlimited.
export const repositoryBindingUsageSchema = z
  .object({
    used: z.number(),
    limit: z.number().nullable(),
  })
  .openapi("RepositoryBindingUsage");

// RFC 0001: linked-state annotation for listed repositories. Same-project
// links block selection in the picker; cross-project links (allowed per
// decision D1) are informational only.
export const repositoryLinkedToSchema = z
  .object({
    integrationId: z.string(),
    projectId: z.string(),
    projectName: z.string().nullable(),
  })
  .openapi("RepositoryLinkedTo");

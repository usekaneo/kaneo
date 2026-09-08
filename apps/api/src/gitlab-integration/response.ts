import { responseTimestamp, z } from "../openapi";

// Credentials are only ever returned masked; the webhook secret goes only to
// callers holding workspace:manage_settings.
export const gitlabIntegrationSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    baseUrl: z
      .string()
      .openapi({ description: "Root URL of the GitLab instance." }),
    repositoryPath: z.string(),
    maskedAccessToken: z.string(),
    webhookUrl: z.string().optional().openapi({
      description: "Where GitLab should POST events for this project.",
    }),
    webhookSecret: z.string().optional().openapi({
      description:
        "Only returned to callers with workspace:manage_settings, so the value can be pasted into GitLab.",
    }),
    branchPattern: z.string().optional(),
    commentTaskLinkOnGitlabIssue: z.boolean().optional().openapi({
      description:
        "When on, Kaneo comments a link back to the task on the linked GitLab issue.",
    }),
    isActive: z.boolean().nullable(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("GitlabIntegration");

export const gitlabRepositorySchema = z
  .object({
    id: z.number(),
    name: z.string(),
    path_with_namespace: z.string(),
    visibility: z.string(),
    web_url: z.string(),
  })
  .openapi("GitlabRepository");

export const gitlabRepositoryListSchema = z
  .object({ repositories: z.array(gitlabRepositorySchema) })
  .openapi("GitlabRepositoryList");

export const gitlabVerificationResultSchema = z
  .object({
    isInstalled: z.boolean(),
    hasRequiredPermissions: z.boolean(),
    repositoryExists: z.boolean(),
    repositoryPrivate: z.boolean().nullable(),
    missingPermissions: z.array(z.string()),
    message: z.string().openapi({
      description: "A human-readable summary to show the user.",
    }),
    failureReason: z
      .enum(["not_a_gitlab_instance", "redirected", "repository_not_found"])
      .nullable(),
  })
  .openapi("GitlabVerificationResult");

export const gitlabImportResultSchema = z
  .object({
    imported: z.number(),
    updated: z.number().openapi({
      description: "Existing tasks that were refreshed from their issue.",
    }),
    skipped: z.number(),
    errors: z.array(z.string()).optional(),
  })
  .openapi("GitlabImportResult");

export const gitlabDeleteResultSchema = z
  .object({ success: z.boolean(), message: z.string() })
  .openapi("GitlabDeleteResult");

export const gitlabIntegrationNotFoundSchema = z
  .object({ error: z.string() })
  .openapi("GitlabIntegrationNotFound");

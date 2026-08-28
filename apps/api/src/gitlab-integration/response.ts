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
    namespace: z.string(),
    projectPath: z.string(),
    fullPath: z.string().openapi({
      description: "`namespace/projectPath`, the way GitLab addresses it.",
    }),
    tokenType: z.enum(["pat", "oauth2"]),
    maskedAccessToken: z.string(),
    webhookUrl: z.string().optional().openapi({
      description: "Where GitLab should POST events for this project.",
    }),
    webhookSecret: z.string().optional().openapi({
      description:
        "Only returned to callers with workspace:manage_settings, so the value can be pasted into GitLab's secret token field.",
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

export const gitlabProjectSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    path: z.string(),
    path_with_namespace: z.string(),
    namespace: z.string(),
    private: z.boolean(),
    web_url: z.string(),
  })
  .openapi("GitlabProject");

export const gitlabProjectListSchema = z
  .object({ projects: z.array(gitlabProjectSchema) })
  .openapi("GitlabProjectList");

export const gitlabVerificationResultSchema = z
  .object({
    isInstalled: z.boolean(),
    hasRequiredPermissions: z.boolean(),
    projectExists: z.boolean(),
    projectPrivate: z.boolean().nullable(),
    missingPermissions: z.array(z.string()),
    message: z.string().openapi({
      description: "A human-readable summary to show the user.",
    }),
    failureReason: z
      .enum([
        "not_a_gitlab_instance",
        "redirected",
        "project_not_found",
        "insecure_transport",
      ])
      .nullable()
      .openapi({
        description:
          "Why verification failed, when it did. `redirected` usually means the base URL is behind a proxy that rewrites it.",
      }),
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

export const integrationNotFoundSchema = z
  .object({ error: z.string() })
  .openapi("GitlabIntegrationNotFound");

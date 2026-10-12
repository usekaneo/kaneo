import { responseTimestamp, z } from "../openapi";
import {
  repositoryBindingUsageSchema,
  repositoryLinkedToSchema,
} from "../integrations/response";

// Tokens are masked; the webhook secret needs manage_settings. The secret is
// per binding now, so each project owner sees only their own binding's secret.
export const gitlabIntegrationSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    baseUrl: z
      .string()
      .openapi({ description: "Root URL of the GitLab instance." }),
    projectPath: z.string().openapi({
      description: "Full path of the linked project, nested groups included.",
    }),
    tokenType: z.enum(["private", "bearer"]),
    maskedAccessToken: z.string().openapi({
      description:
        "First and last characters of the stored token, only returned to callers with workspace:manage_settings.",
    }),
    webhookUrl: z.string().optional().openapi({
      description: "Where GitLab should POST events for this binding.",
    }),
    webhookSecret: z.string().optional().openapi({
      description:
        "Only returned to callers with workspace:manage_settings, so the value can be pasted into GitLab. Per binding.",
    }),
    branchPattern: z.string().optional(),
    commentTaskLinkOnGitlabIssue: z.boolean().optional().openapi({
      description:
        "When on, Kaneo comments a link back to the task on each issue opened in GitLab. Issues Kaneo creates from tasks are not commented on.",
    }),
    isActive: z.boolean().nullable(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("GitlabIntegration");

// RFC 0001 WP4: array shape for the list route plus the WP10 usage summary.
export const gitlabIntegrationListSchema = z
  .object({
    integrations: z.array(gitlabIntegrationSchema),
    usage: repositoryBindingUsageSchema,
  })
  .openapi("GitlabIntegrationList");

export const gitlabProjectSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    path_with_namespace: z.string(),
    name_with_namespace: z.string(),
    visibility: z.string(),
    web_url: z.string(),
    linkedTo: repositoryLinkedToSchema
      .nullable()
      .optional()
      .openapi({
        description:
          "The binding this GitLab project is already linked to, when any. Same-project links block selection; cross-project links (allowed per RFC decision D1) are informational only.",
      }),
  })
  .openapi("GitlabProject");

export const gitlabProjectListSchema = z
  .object({ projects: z.array(gitlabProjectSchema) })
  .openapi("GitlabProjectList");

export const gitlabVerificationResultSchema = z
  .object({
    isInstalled: z.boolean().openapi({
      description: "The base URL answered as a GitLab instance for this token.",
    }),
    hasRequiredPermissions: z.boolean(),
    projectExists: z.boolean(),
    projectVisibility: z.string().nullable(),
    missingPermissions: z.array(z.string()),
    message: z.string().openapi({
      description: "A human-readable summary to show the user.",
    }),
    failureReason: z
      .enum(["not_a_gitlab_instance", "redirected", "project_not_found"])
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

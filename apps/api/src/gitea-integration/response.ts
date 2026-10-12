import { responseTimestamp, z } from "../openapi";
import {
  repositoryBindingUsageSchema,
  repositoryLinkedToSchema,
} from "../integrations/response";

// Credentials are only ever returned masked; the webhook secret goes only to
// callers holding workspace:manage_settings. The secret is per binding now,
// so each project owner sees only their own binding's secret.
export const giteaIntegrationSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    baseUrl: z
      .string()
      .openapi({ description: "Root URL of the Gitea instance." }),
    repositoryOwner: z.string(),
    repositoryName: z.string(),
    maskedAccessToken: z.string(),
    webhookUrl: z.string().optional().openapi({
      description: "Where Gitea should POST events for this binding.",
    }),
    webhookSecret: z.string().optional().openapi({
      description:
        "Only returned to callers with workspace:manage_settings, so the value can be pasted into Gitea. Per binding.",
    }),
    branchPattern: z.string().optional(),
    commentTaskLinkOnGiteaIssue: z.boolean().optional().openapi({
      description:
        "When on, Kaneo comments a link back to the task on the linked Gitea issue.",
    }),
    isActive: z.boolean().nullable(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("GiteaIntegration");

// RFC 0001 WP3: array shape for the list route plus the WP10 usage summary.
export const giteaIntegrationListSchema = z
  .object({
    integrations: z.array(giteaIntegrationSchema),
    usage: repositoryBindingUsageSchema,
  })
  .openapi("GiteaIntegrationList");

export const giteaRepositorySchema = z
  .object({
    id: z.number(),
    name: z.string(),
    full_name: z.string(),
    owner: z.object({ login: z.string() }).openapi("GiteaRepositoryOwner"),
    private: z.boolean(),
    html_url: z.string(),
    linkedTo: repositoryLinkedToSchema
      .nullable()
      .optional()
      .openapi({
        description:
          "The binding this repository is already linked to, when any. Same-project links block selection; cross-project links (allowed per RFC decision D1) are informational only.",
      }),
  })
  .openapi("GiteaRepository");

export const giteaRepositoryListSchema = z
  .object({ repositories: z.array(giteaRepositorySchema) })
  .openapi("GiteaRepositoryList");

export const giteaVerificationResultSchema = z
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
      .enum(["not_a_gitea_instance", "redirected", "repository_not_found"])
      .nullable()
      .openapi({
        description:
          "Why verification failed, when it did. `redirected` usually means the base URL is behind a proxy that rewrites it.",
      }),
  })
  .openapi("GiteaVerificationResult");

export const giteaImportResultSchema = z
  .object({
    imported: z.number(),
    updated: z.number().openapi({
      description: "Existing tasks that were refreshed from their issue.",
    }),
    skipped: z.number(),
    errors: z.array(z.string()).optional(),
  })
  .openapi("GiteaImportResult");

export const giteaDeleteResultSchema = z
  .object({ success: z.boolean(), message: z.string() })
  .openapi("GiteaDeleteResult");

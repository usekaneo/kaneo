import { responseTimestamp, z } from "../openapi";

export const githubIntegrationSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    repositoryOwner: z.string(),
    repositoryName: z.string(),
    installationId: z.number().nullable().openapi({
      description:
        "The GitHub App installation that grants access to the repository.",
    }),
    branchPattern: z.string().optional().openapi({
      description: "Template used to name branches created for a task.",
    }),
    commentTaskLinkOnGitHubIssue: z.boolean().optional().openapi({
      description:
        "When on, Kaneo comments a link back to the task on the linked GitHub issue.",
    }),
    isActive: z.boolean().nullable(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("GitHubIntegration");

export const githubAppInfoSchema = z
  .object({
    appName: z.string().nullable().openapi({
      description:
        "The configured GitHub App slug, or null when this instance has no App set up.",
    }),
  })
  .openapi("GitHubAppInfo");

export const githubRepositorySchema = z
  .object({
    id: z.number(),
    name: z.string(),
    full_name: z.string(),
    private: z.boolean(),
    owner: z
      .object({
        login: z.string(),
        avatar_url: z.string(),
        type: z.string(),
      })
      .openapi("GitHubRepositoryOwner"),
    description: z.string().nullable(),
    html_url: z.string(),
    permissions: z
      .object({
        admin: z.boolean(),
        push: z.boolean(),
        pull: z.boolean(),
      })
      .optional()
      .openapi("GitHubRepositoryPermissions"),
    updated_at: z.string().openapi({ format: "date-time" }),
    installation_id: z.number().openapi({
      description: "Which App installation this repository came through.",
    }),
  })
  .openapi("GitHubRepository");

export const githubInstallationSchema = z
  .object({
    id: z.number(),
    account: z
      .object({ login: z.string(), type: z.string() })
      .nullable()
      .openapi("GitHubInstallationAccount"),
    repositories: z.array(z.string()).openapi({
      description:
        "Full names of the repositories under this installation. Empty when listing them failed.",
    }),
  })
  .openapi("GitHubInstallation");

export const githubRepositoryListSchema = z
  .object({
    repositories: z.array(githubRepositorySchema).openapi({
      description:
        "Deduplicated across installations, most recently updated first.",
    }),
    installations: z.array(githubInstallationSchema),
    total: z.number(),
  })
  .openapi("GitHubRepositoryList");

export const verificationResultSchema = z
  .object({
    isInstalled: z.boolean(),
    installationId: z.number().nullable(),
    repositoryExists: z.boolean().nullable(),
    repositoryPrivate: z.boolean().nullable(),
    permissions: z.record(z.string(), z.string()).nullable().openapi({
      description: "The permissions the installation currently grants.",
    }),
    hasRequiredPermissions: z.boolean(),
    missingPermissions: z.array(z.string()).openapi({
      description:
        "Permissions that must be granted before the link will work.",
    }),
    message: z.string().openapi({
      description: "A human-readable summary to show the user.",
    }),
    settingsUrl: z.string().optional().openapi({
      description: "Where to adjust the installation, when one exists.",
    }),
    installationUrl: z.string().optional().openapi({
      description: "Where to install the App, when it is not installed yet.",
    }),
  })
  .openapi("GitHubVerificationResult");

export const importResultSchema = z
  .object({
    imported: z.number(),
    skipped: z.number().openapi({
      description: "Issues that already had a task, or were not importable.",
    }),
    errors: z.array(z.string()).optional(),
  })
  .openapi("IssueImportResult");

export const createdGithubIntegrationSchema = githubIntegrationSchema
  .partial({
    id: true,
    projectId: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  })
  .openapi("CreatedGitHubIntegration");

export const deleteResultSchema = z
  .object({ success: z.boolean(), message: z.string() })
  .openapi("GitHubDeleteResult");

export const integrationNotFoundSchema = z
  .object({ error: z.string() })
  .openapi("GitHubIntegrationNotFound");

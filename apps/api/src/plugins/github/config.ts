import * as v from "valibot";

export const branchPatterns = [
  "{slug}-{number}",
  "{slug}-{number}-{title}",
  "{number}",
  "{number}-{title}",
  "feature/{slug}-{number}",
  "feature/{number}-{title}",
  "fix/{slug}-{number}",
  "fix/{number}-{title}",
] as const;

export type BranchPattern = (typeof branchPatterns)[number] | "custom";

export const githubConfigSchema = v.object({
  repositoryOwner: v.string(),
  repositoryName: v.string(),
  installationId: v.nullable(v.number()),
  repositoryId: v.optional(v.number()),
  verifiedGithubAccountId: v.optional(v.string()),
  verifiedByUserId: v.optional(v.string()),
  branchPattern: v.optional(v.string()),
  customBranchRegex: v.optional(v.string()),
  commentTaskLinkOnGitHubIssue: v.optional(v.boolean()),
  statusTransitions: v.optional(
    v.object({
      onBranchPush: v.optional(v.string()),
      onPROpen: v.optional(v.string()),
      onPRMerge: v.optional(v.string()),
    }),
  ),
});

export type GitHubConfig = v.InferOutput<typeof githubConfigSchema>;

export async function validateGitHubConfig(
  config: unknown,
): Promise<{ valid: boolean; errors?: string[] }> {
  try {
    v.parse(githubConfigSchema, config);
    return { valid: true };
  } catch (error) {
    if (error instanceof v.ValiError) {
      return {
        valid: false,
        errors: error.issues.map((issue) => issue.message),
      };
    }
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : "Invalid config"],
    };
  }
}

export const defaultGitHubConfig: Partial<GitHubConfig> = {
  branchPattern: "{slug}-{number}",
  commentTaskLinkOnGitHubIssue: true,
  statusTransitions: {
    onBranchPush: "in-progress",
    onPROpen: "in-review",
    onPRMerge: "done",
  },
};

export function getDefaultConfig(
  repositoryOwner: string,
  repositoryName: string,
  installationId: number | null = null,
): GitHubConfig {
  return {
    repositoryOwner,
    repositoryName,
    installationId,
    ...defaultGitHubConfig,
  };
}

/** Legacy integrations require explicit re-verification by a repository administrator. */
export function hasVerifiedGitHubBinding(config: GitHubConfig): boolean {
  return (
    Number.isSafeInteger(config.installationId) &&
    (config.installationId ?? 0) > 0 &&
    Number.isSafeInteger(config.repositoryId) &&
    (config.repositoryId ?? 0) > 0 &&
    typeof config.verifiedGithubAccountId === "string" &&
    /^[1-9][0-9]*$/.test(config.verifiedGithubAccountId) &&
    typeof config.verifiedByUserId === "string" &&
    config.verifiedByUserId.length > 0
  );
}

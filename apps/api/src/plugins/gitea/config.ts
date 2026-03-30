import * as v from "valibot";
import { branchPatterns } from "../github/config";

export { branchPatterns };

export const giteaConfigSchema = v.object({
  baseUrl: v.string(),
  accessToken: v.string(),
  repositoryOwner: v.string(),
  repositoryName: v.string(),
  webhookSecret: v.optional(v.string()),
  branchPattern: v.optional(v.string()),
  customBranchRegex: v.optional(v.string()),
  commentTaskLinkOnGiteaIssue: v.optional(v.boolean()),
  statusTransitions: v.optional(
    v.object({
      onBranchPush: v.optional(v.string()),
      onPROpen: v.optional(v.string()),
      onPRMerge: v.optional(v.string()),
    }),
  ),
});

export type GiteaConfig = v.InferOutput<typeof giteaConfigSchema>;

export async function validateGiteaConfig(
  config: unknown,
): Promise<{ valid: boolean; errors?: string[] }> {
  try {
    v.parse(giteaConfigSchema, config);
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

export const defaultGiteaConfig: Partial<GiteaConfig> = {
  branchPattern: "{slug}-{number}",
  commentTaskLinkOnGiteaIssue: true,
  statusTransitions: {
    onBranchPush: "in-progress",
    onPROpen: "in-review",
    onPRMerge: "done",
  },
};

export function normalizeGiteaBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function getDefaultGiteaConfig(
  baseUrl: string,
  accessToken: string,
  repositoryOwner: string,
  repositoryName: string,
  webhookSecret: string,
): GiteaConfig {
  return {
    baseUrl: normalizeGiteaBaseUrl(baseUrl),
    accessToken,
    repositoryOwner,
    repositoryName,
    webhookSecret,
    ...defaultGiteaConfig,
  };
}

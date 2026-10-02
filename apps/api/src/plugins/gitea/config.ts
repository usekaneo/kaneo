import * as v from "valibot";
import { branchPatterns } from "../github/config";

export { branchPatterns };

export const giteaIssueSyncModes = ["sync", "ingest-only", "off"] as const;
export type GiteaIssueSyncMode = (typeof giteaIssueSyncModes)[number];

export const giteaConfigSchema = v.object({
  baseUrl: v.pipe(v.string(), v.url()),
  accessToken: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  repositoryOwner: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  repositoryName: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  webhookSecret: v.optional(v.string()),
  issueSyncMode: v.optional(v.picklist(giteaIssueSyncModes)),
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

export function getGiteaIssueSyncMode(
  config: Pick<GiteaConfig, "issueSyncMode">,
): GiteaIssueSyncMode {
  return config.issueSyncMode ?? "sync";
}

export function canSyncGiteaIssues(
  config: Pick<GiteaConfig, "issueSyncMode">,
): boolean {
  return getGiteaIssueSyncMode(config) === "sync";
}

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
  issueSyncMode: "sync",
  branchPattern: "{slug}-{number}",
  commentTaskLinkOnGiteaIssue: true,
  statusTransitions: {
    onBranchPush: "in-progress",
    onPROpen: "in-review",
    onPRMerge: "done",
  },
};

export function normalizeGiteaBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  const parsed = new URL(trimmed);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Gitea base URL must use http or https");
  }

  // A query or fragment would swallow the appended /api/v1/... path and let a
  // caller aim the request at an arbitrary path on the target host.
  if (parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error(
      "Gitea base URL must not contain a query, fragment, or credentials",
    );
  }

  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
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

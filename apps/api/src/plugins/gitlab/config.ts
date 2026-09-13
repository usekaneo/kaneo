import * as v from "valibot";
import { privateDestinationsAllowed } from "../../utils/assert-public-destination";
import { branchPatterns } from "../github/config";

export { branchPatterns };

export const gitlabConfigSchema = v.object({
  baseUrl: v.pipe(v.string(), v.url()),
  accessToken: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  tokenType: v.optional(v.picklist(["private", "bearer"])),
  projectPath: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  webhookSecret: v.optional(v.string()),
  branchPattern: v.optional(v.string()),
  customBranchRegex: v.optional(v.string()),
  commentTaskLinkOnGitlabIssue: v.optional(v.boolean()),
  statusTransitions: v.optional(
    v.object({
      onBranchPush: v.optional(v.string()),
      onPROpen: v.optional(v.string()),
      onPRMerge: v.optional(v.string()),
    }),
  ),
});

export type GitlabConfig = v.InferOutput<typeof gitlabConfigSchema>;

export type GitlabTokenType = "private" | "bearer";

export async function validateGitlabConfig(
  config: unknown,
): Promise<{ valid: boolean; errors?: string[] }> {
  try {
    v.parse(gitlabConfigSchema, config);
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

export const GITLAB_CLOUD_URL = "https://gitlab.com";

export const defaultGitlabConfig: Partial<GitlabConfig> = {
  branchPattern: "{slug}-{number}",
  commentTaskLinkOnGitlabIssue: true,
  statusTransitions: {
    onBranchPush: "in-progress",
    onPROpen: "in-review",
    onPRMerge: "done",
  },
};

export function normalizeGitlabBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  const parsed = new URL(trimmed);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("GitLab base URL must use http or https");
  }

  // A query or fragment would break the /api/v4 path appended later.
  if (parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error(
      "GitLab base URL must not contain a query, fragment, or credentials",
    );
  }

  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

// The token travels in a request header, so plain http is only accepted for
// instances on a private network.
export function assertGitlabTransport(baseUrl: string): void {
  if (new URL(baseUrl).protocol === "http:" && !privateDestinationsAllowed()) {
    throw new Error(
      "GitLab URL must use https unless KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS is enabled",
    );
  }
}

// Reject a leading slash or ".." before the path goes into the URL.
export function normalizeProjectPath(path: string): string {
  const segments = path
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);

  if (segments.length < 2) {
    throw new Error(
      "GitLab project path must include a namespace, for example group/project",
    );
  }

  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("GitLab project path must not contain relative segments");
  }

  return segments.join("/");
}

export function getDefaultGitlabConfig(
  baseUrl: string,
  accessToken: string,
  tokenType: GitlabTokenType,
  projectPath: string,
  webhookSecret: string,
): GitlabConfig {
  return {
    baseUrl: normalizeGitlabBaseUrl(baseUrl),
    accessToken,
    tokenType,
    projectPath: normalizeProjectPath(projectPath),
    webhookSecret,
    ...defaultGitlabConfig,
  };
}

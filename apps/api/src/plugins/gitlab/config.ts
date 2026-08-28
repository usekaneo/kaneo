import * as v from "valibot";
import { branchPatterns } from "../github/config";

export { branchPatterns };

export const gitlabConfigSchema = v.object({
  baseUrl: v.pipe(v.string(), v.url()),
  accessToken: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  // GitLab accepts personal, project, and group access tokens through the
  // PRIVATE-TOKEN header, but an OAuth2 token only through Authorization.
  tokenType: v.optional(v.picklist(["pat", "oauth2"])),
  namespace: v.pipe(v.string(), v.trim(), v.nonEmpty()),
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

export const defaultGitlabConfig: Partial<GitlabConfig> = {
  branchPattern: "{slug}-{number}",
  commentTaskLinkOnGitlabIssue: true,
  statusTransitions: {
    onBranchPush: "in-progress",
    onPROpen: "in-review",
    onPRMerge: "done",
  },
};

export const DEFAULT_GITLAB_BASE_URL = "https://gitlab.com";

/**
 * Operator acknowledgement that a GitLab access token may travel over plain
 * http. Deliberately separate from KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS:
 * allowing Kaneo to reach an internal host says nothing about whether
 * credentials may cross that network unencrypted.
 */
export function insecureGitlabUrlAllowed(): boolean {
  return (
    process.env.KANEO_ALLOW_INSECURE_GITLAB_URL === "true" ||
    process.env.KANEO_ALLOW_INSECURE_GITLAB_URL === "1"
  );
}

export function normalizeGitlabBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  const parsed = new URL(trimmed);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("GitLab base URL must use http or https");
  }

  // The access token travels on every request, so plain http puts it on the
  // wire in the clear, where anyone on the path can read it -- a private
  // network is not automatically a trusted one. That is a call only the
  // operator can make, so it needs its own acknowledgement rather than riding
  // on a flag set for webhook delivery. gitlabFetch additionally refuses to
  // send the token over http to anything that resolves publicly.
  if (parsed.protocol === "http:" && !insecureGitlabUrlAllowed()) {
    throw new Error(
      "GitLab base URL must use https, so the access token is not sent in the clear",
    );
  }

  // A query or fragment would swallow the appended /api/v4/... path and let a
  // caller aim the request at an arbitrary path on the target host.
  if (parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error(
      "GitLab base URL must not contain a query, fragment, or credentials",
    );
  }

  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

/** `group/subgroup` + `repo` is the path GitLab addresses a project by. */
export function projectFullPath(
  config: Pick<GitlabConfig, "namespace" | "projectPath">,
): string {
  return `${config.namespace}/${config.projectPath}`;
}

export function getDefaultGitlabConfig(
  baseUrl: string,
  accessToken: string,
  tokenType: "pat" | "oauth2",
  namespace: string,
  projectPath: string,
  webhookSecret: string,
): GitlabConfig {
  return {
    baseUrl: normalizeGitlabBaseUrl(baseUrl),
    accessToken,
    tokenType,
    namespace,
    projectPath,
    webhookSecret,
    ...defaultGitlabConfig,
  };
}

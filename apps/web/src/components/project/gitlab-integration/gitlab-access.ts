import { tokenFingerprint } from "@/lib/token-fingerprint";

export type GitlabTokenType = "private" | "bearer";

export const GITLAB_CLOUD_URL = "https://gitlab.com";

const PROJECT_PATH_PATTERN = /^[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)+$/;

export type GitlabAccess = {
  baseUrl: string;
  accessToken?: string;
  tokenType: GitlabTokenType;
  projectPath: string;
};

export function normalizeProjectPath(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, "");
}

export function isValidProjectPath(value: string) {
  return PROJECT_PATH_PATTERN.test(normalizeProjectPath(value));
}

export function gitlabAccessKey(access: GitlabAccess) {
  return [
    access.baseUrl,
    access.tokenType,
    access.projectPath,
    access.accessToken ? tokenFingerprint(access.accessToken) : "stored",
  ].join("|");
}

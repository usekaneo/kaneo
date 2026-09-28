import { HTTPException } from "hono/http-exception";
import {
  assertGitlabTransport,
  normalizeGitlabBaseUrl,
  normalizeProjectPath,
} from "../../plugins/gitlab/config";

function orBadRequest<T>(normalize: () => T): T {
  try {
    return normalize();
  } catch (error) {
    throw new HTTPException(400, {
      message: error instanceof Error ? error.message : "Invalid GitLab input",
    });
  }
}

export function parseGitlabBaseUrl(url: string): string {
  return orBadRequest(() => {
    const normalized = normalizeGitlabBaseUrl(url);
    assertGitlabTransport(normalized);
    return normalized;
  });
}

export function parseGitlabProjectPath(path: string): string {
  return orBadRequest(() => normalizeProjectPath(path));
}

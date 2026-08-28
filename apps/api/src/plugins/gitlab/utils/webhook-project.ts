import { normalizeGitlabBaseUrl } from "../config";

export type WebhookProject = {
  web_url?: string;
  path_with_namespace?: string;
};

/**
 * GitLab webhooks carry the project's own URL but not the instance root, and a
 * self-managed instance may live under a path prefix. Trimming the known
 * project path off `web_url` leaves that root.
 */
export function baseUrlFromProjectWebUrl(project: WebhookProject): string {
  const { web_url: webUrl, path_with_namespace: pathWithNamespace } = project;
  if (!webUrl || !pathWithNamespace) {
    return "";
  }

  try {
    const url = new URL(webUrl);
    const suffix = `/${pathWithNamespace.replace(/^\/+/, "")}`;
    if (!url.pathname.endsWith(suffix)) {
      return "";
    }

    const basePath = url.pathname.slice(0, -suffix.length);
    return normalizeGitlabBaseUrl(`${url.origin}${basePath}`);
  } catch {
    return "";
  }
}

/** Splits `group/subgroup/repo` into its namespace and project path. */
export function splitProjectPath(
  pathWithNamespace: string,
): { namespace: string; projectPath: string } | null {
  const segments = pathWithNamespace.split("/").filter(Boolean);
  if (segments.length < 2) {
    return null;
  }
  const projectPath = segments[segments.length - 1] as string;
  return {
    namespace: segments.slice(0, -1).join("/"),
    projectPath,
  };
}

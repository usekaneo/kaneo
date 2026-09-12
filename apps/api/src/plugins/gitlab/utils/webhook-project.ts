import { normalizeGitlabBaseUrl } from "../config";

// A webhook payload carries the project's web URL and its full path, so the
// instance root is the URL with that path removed. This also covers instances
// served under a path prefix, where the root is not just the origin.
export function baseUrlFromProjectWebUrl(
  webUrl: string,
  pathWithNamespace: string,
): string {
  try {
    const url = new URL(webUrl);
    const path = url.pathname.replace(/^\/+|\/+$/g, "");
    const suffix = pathWithNamespace.replace(/^\/+|\/+$/g, "");

    if (!suffix || !path.endsWith(suffix)) {
      return "";
    }

    const basePath = path.slice(0, path.length - suffix.length);

    return normalizeGitlabBaseUrl(`${url.origin}/${basePath}`);
  } catch {
    return "";
  }
}

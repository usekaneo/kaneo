import { normalizeGitlabBaseUrl } from "../config";

// Instance root is web_url minus the project path, keeping any path prefix.
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

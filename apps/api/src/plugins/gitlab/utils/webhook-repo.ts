import { normalizeGitlabBaseUrl } from "../config";

export function baseUrlFromProjectWebUrl(
  webUrl: string,
  pathWithNamespace: string,
): string {
  try {
    const u = new URL(webUrl);
    const suffix = `/${pathWithNamespace}`;
    if (!u.pathname.endsWith(suffix)) {
      return "";
    }
    const basePath = u.pathname.slice(0, -suffix.length);
    return normalizeGitlabBaseUrl(`${u.origin}${basePath}`);
  } catch {
    return "";
  }
}

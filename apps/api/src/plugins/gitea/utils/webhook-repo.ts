import { normalizeGiteaBaseUrl } from "../config";

export function baseUrlFromRepositoryHtmlUrl(htmlUrl: string): string {
  try {
    const u = new URL(htmlUrl);
    return normalizeGiteaBaseUrl(`${u.protocol}//${u.host}`);
  } catch {
    return "";
  }
}

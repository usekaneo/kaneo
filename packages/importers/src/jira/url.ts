export type JiraSite = {
  baseUrl: string;
  cloud: boolean;
};

export const MISSING_URL_MESSAGE =
  "Add your Jira site URL, for example https://your-site.atlassian.net";

const UI_SEGMENTS = new Set([
  "browse",
  "secure",
  "projects",
  "plugins",
  "issues",
  "rest",
  "servicedesk",
]);

const CLOUD_APP_SEGMENTS = new Set([
  "software",
  "core",
  "business",
  "your-work",
  "for-you",
  "dashboards",
  "filters",
  "plans",
  "people",
  "settings",
  "boards",
  "apps",
  "polaris",
  "discovery",
]);

const PAGE_FILE = /\.(?:jspa?|action)$/i;

export function parseJiraUrl(rawUrl: string | null | undefined): JiraSite {
  const url = toUrl(rawUrl?.trim() ?? "");
  if (!url) throw new Error(MISSING_URL_MESSAGE);

  const origin = `${url.protocol}//${url.host}`;
  if (isCloudHost(url.hostname)) return { baseUrl: origin, cloud: true };

  const contextPath = contextSegments(url.pathname).join("/");
  return {
    baseUrl: contextPath ? `${origin}/${contextPath}` : origin,
    cloud: false,
  };
}

function toUrl(value: string): URL | null {
  if (!value) return null;
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(value)
    ? value
    : `https://${value.replace(/^\/+/, "")}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.hostname ? url : null;
  } catch {
    return null;
  }
}

function isCloudHost(hostname: string): boolean {
  return hostname.toLowerCase().endsWith(".atlassian.net");
}

function contextSegments(pathname: string): string[] {
  const segments = pathname.split("/").filter(Boolean);
  const kept: string[] = [];
  for (const [index, segment] of segments.entries()) {
    if (isUiSegment(segment, segments[index + 1])) break;
    kept.push(segment);
  }
  return kept;
}

function isUiSegment(segment: string, next: string | undefined): boolean {
  const name = segment.toLowerCase();
  if (UI_SEGMENTS.has(name) || PAGE_FILE.test(name)) return true;
  return (
    name === "jira" &&
    next !== undefined &&
    CLOUD_APP_SEGMENTS.has(next.toLowerCase())
  );
}

export type PlaneTarget = {
  apiBaseUrl: string;
  workspaceSlug: string;
};

export const PLANE_CLOUD_API = "https://api.plane.so";

export const MISSING_WORKSPACE_MESSAGE =
  "Add your Plane workspace URL, for example https://app.plane.so/your-workspace";

const NON_WORKSPACE_SEGMENTS = new Set([
  "api",
  "god-mode",
  "profile",
  "accounts",
  "sign-in",
  "sign-up",
  "onboarding",
  "invitations",
  "workspace-invitations",
  "create-workspace",
  "installations",
  "spaces",
  "auth",
  "live",
]);

export function parsePlaneUrl(
  rawUrl: string | null | undefined,
  explicitSlug?: string | null,
): PlaneTarget {
  const slugOverride = cleanSlug(explicitSlug);
  const trimmed = rawUrl?.trim() ?? "";

  if (!trimmed) {
    if (slugOverride) {
      return { apiBaseUrl: PLANE_CLOUD_API, workspaceSlug: slugOverride };
    }
    throw new Error(MISSING_WORKSPACE_MESSAGE);
  }

  const url = toUrl(trimmed);
  if (!url) throw new Error(MISSING_WORKSPACE_MESSAGE);

  const apiBaseUrl = isPlaneCloud(url.hostname)
    ? PLANE_CLOUD_API
    : `${url.protocol}//${url.host}`;
  const workspaceSlug = slugOverride ?? slugFromPath(url.pathname);
  if (!workspaceSlug) throw new Error(MISSING_WORKSPACE_MESSAGE);

  return { apiBaseUrl, workspaceSlug };
}

function toUrl(value: string): URL | null {
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

function isPlaneCloud(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "plane.so" || host.endsWith(".plane.so");
}

function slugFromPath(pathname: string): string | undefined {
  const segments = pathname
    .split("/")
    .map((segment) => safeDecode(segment).trim())
    .filter(Boolean);
  const first = segments[0];
  if (!first) return undefined;

  if (first.toLowerCase() === "api") {
    const index = segments.findIndex(
      (segment) => segment.toLowerCase() === "workspaces",
    );
    return index === -1 ? undefined : segments[index + 1];
  }

  return NON_WORKSPACE_SEGMENTS.has(first.toLowerCase()) ? undefined : first;
}

function cleanSlug(value: string | null | undefined): string | undefined {
  const slug = value?.trim().replace(/^\/+|\/+$/g, "");
  return slug ? slug : undefined;
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

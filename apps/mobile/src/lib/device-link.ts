const ORIGIN = /^https?:\/\/[^/?#]*/i;

function hostOf(origin: string) {
  const authority = origin.replace(/^https?:\/\//i, "").replace(/^[^@]*@/, "");
  const host = authority.startsWith("[")
    ? authority.slice(0, authority.indexOf("]") + 1)
    : authority.split(":")[0];
  return (host ?? "").toLowerCase();
}

function isLoopback(host: string) {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.startsWith("127.") ||
    host === "[::1]" ||
    host === "0.0.0.0"
  );
}

/**
 * The API builds the approval link from its configured web URL, which some deployments leave at
 * `http://localhost`. On a phone that opens the phone itself, so such links are pointed at the
 * server the app connected to, keeping the path and query.
 */
export function reachableDeviceLink(link: string, serverUrl: string): string {
  const linkOrigin = link.match(ORIGIN)?.[0];
  const serverOrigin = serverUrl.match(ORIGIN)?.[0];
  if (!linkOrigin || !serverOrigin) return link;
  if (!isLoopback(hostOf(linkOrigin)) || isLoopback(hostOf(serverOrigin)))
    return link;
  return serverOrigin + link.slice(linkOrigin.length);
}

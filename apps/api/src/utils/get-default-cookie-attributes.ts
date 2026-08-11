interface CookieAttributeUrls {
  apiUrl: string;
  clientUrl: string;
  cookieDomain?: string;
}

export function getDefaultCookieAttributes({
  apiUrl,
  clientUrl,
  cookieDomain,
}: CookieAttributeUrls) {
  const isHttps = apiUrl.startsWith("https://");
  const isCrossSubdomain = (() => {
    try {
      const apiHost = new URL(apiUrl).hostname;
      const clientHost = new URL(clientUrl).hostname;
      return (
        apiHost !== clientHost &&
        apiHost !== "localhost" &&
        clientHost !== "localhost"
      );
    } catch {
      return false;
    }
  })();

  return {
    sameSite:
      isCrossSubdomain && isHttps ? ("none" as const) : ("lax" as const),
    secure: isHttps,
    partitioned: isCrossSubdomain && isHttps,
    domain: cookieDomain || undefined,
  };
}

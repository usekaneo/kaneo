type CookieAttributeUrls = {
  apiUrl: string;
  clientUrl: string;
  cookieDomain?: string;
};

export function getDefaultCookieAttributes({
  apiUrl,
  clientUrl,
  cookieDomain,
}: CookieAttributeUrls) {
  const parsedApiUrl = (() => {
    try {
      return new URL(apiUrl);
    } catch {
      return undefined;
    }
  })();
  const isHttps = parsedApiUrl?.protocol === "https:";
  const isCrossSubdomain = (() => {
    try {
      const apiHost = parsedApiUrl?.hostname;
      const clientHost = new URL(clientUrl).hostname;
      return (
        apiHost !== undefined &&
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

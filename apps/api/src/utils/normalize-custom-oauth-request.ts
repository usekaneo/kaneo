// Keep registered redirect URIs and older clients working with Better Auth 1.7.
export async function normalizeCustomOAuthRequest(request: Request) {
  const url = new URL(request.url);
  if (url.pathname === "/api/auth/oauth2/callback/custom") {
    url.pathname = "/api/auth/callback/custom";
    return new Request(url, request);
  }

  if (
    url.pathname === "/api/auth/sign-in/oauth2" &&
    request.method === "POST"
  ) {
    const body: unknown = await request
      .clone()
      .json()
      .catch(() => null);
    if (
      body &&
      typeof body === "object" &&
      "providerId" in body &&
      body.providerId === "custom"
    ) {
      url.pathname = "/api/auth/sign-in/social";
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      return new Request(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...body, provider: "custom" }),
      });
    }
  }

  return request;
}

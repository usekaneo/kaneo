import { HTTPException } from "hono/http-exception";
import { auth } from "../auth";
import { apiRouter, createRoute } from "../openapi";
import buildLogoutUrl from "./controllers/build-logout-url";

const clientOrigin = () =>
  (process.env.KANEO_CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");

const apiOrigin = () =>
  (process.env.KANEO_API_URL || "http://localhost:1337")
    .replace(/\/api\/?$/, "")
    .replace(/\/+$/, "");

function assertSameSiteNavigation(referer: string | undefined) {
  if (!referer) {
    throw new HTTPException(403, { message: "Untrusted logout origin" });
  }
  let origin: string;
  try {
    origin = new URL(referer).origin;
  } catch {
    throw new HTTPException(403, { message: "Untrusted logout origin" });
  }
  const trusted = [clientOrigin(), apiOrigin()].map((url) => {
    try {
      return new URL(url).origin;
    } catch {
      return url;
    }
  });
  if (!trusted.includes(origin)) {
    throw new HTTPException(403, { message: "Untrusted logout origin" });
  }
}

const logoutRoute = createRoute({
  method: "get",
  operationId: "oauthLogout",
  path: "/logout",
  tags: ["Authentication"],
  summary: "Log out",
  description:
    "Ends the Kaneo session and redirects to the identity provider's end-session endpoint so the provider closes its session too. The id_token_hint the provider needs is attached server-side, so navigate to this URL rather than fetching it. Redirects to the sign-in page when no custom OAuth logout URL is configured.",
  responses: {
    302: { description: "Redirect to the identity provider, or to sign-in" },
    403: { description: "API keys, or a navigation from an untrusted origin" },
    500: { description: "The session could not be ended" },
  },
});

const oauth = apiRouter().openapi(logoutRoute, async (c) => {
  if (c.get("apiKey") || c.req.header("authorization")) {
    throw new HTTPException(403, {
      message: "Log out from the browser session that created it",
    });
  }

  assertSameSiteNavigation(c.req.header("referer"));

  let providerLogoutUrl: string | null = null;
  try {
    providerLogoutUrl = await buildLogoutUrl(c.get("userId"));
  } catch (error) {
    console.error("Failed to build the provider logout URL:", error);
  }

  let clearedCookies: string[];
  try {
    const signedOut = await auth.api.signOut({
      headers: c.req.raw.headers,
      asResponse: true,
    });
    clearedCookies = signedOut.headers.getSetCookie();
  } catch (error) {
    console.error("Failed to end the session during logout:", error);
    throw new HTTPException(500, { message: "Could not complete sign out" });
  }

  const response = c.redirect(
    providerLogoutUrl ?? `${clientOrigin()}/auth/sign-in`,
    302,
  );
  for (const cookie of clearedCookies) {
    response.headers.append("set-cookie", cookie);
  }
  response.headers.set("cache-control", "no-store");
  return response;
});

export default oauth;

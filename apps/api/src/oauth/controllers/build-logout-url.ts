import { and, eq } from "drizzle-orm";
import db, { schema } from "../../database";

async function storedIdToken(userId: string) {
  const [account] = await db
    .select({ idToken: schema.accountTable.idToken })
    .from(schema.accountTable)
    .where(
      and(
        eq(schema.accountTable.userId, userId),
        eq(schema.accountTable.providerId, "custom"),
      ),
    )
    .limit(1);
  return account?.idToken ?? null;
}

async function buildLogoutUrl(userId: string) {
  const configured = process.env.CUSTOM_OAUTH_LOGOUT_URL;
  if (!configured) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    console.error("CUSTOM_OAUTH_LOGOUT_URL is not a valid URL");
    return null;
  }

  const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !isLoopback) {
    console.error(
      "CUSTOM_OAUTH_LOGOUT_URL must use https; id_token_hint would otherwise be sent in cleartext",
    );
    return null;
  }

  const clientUrl = process.env.KANEO_CLIENT_URL?.replace(/\/+$/, "");
  if (clientUrl) {
    url.searchParams.set(
      "post_logout_redirect_uri",
      `${clientUrl}/auth/sign-in`,
    );
  }

  const idToken = await storedIdToken(userId);
  if (idToken) {
    url.searchParams.set("id_token_hint", idToken);
  }

  return url.toString();
}

export default buildLogoutUrl;

const date = "2026-09-01T10:00:00.000Z";
const user = {
  id: "ui-review-user",
  name: "Alex Morgan",
  email: "alex@example.test",
  emailVerified: true,
  isAnonymous: false,
  image: null,
  locale: "en-US",
  createdAt: date,
  updatedAt: date,
  role: "user",
};
const organization = {
  id: "ui-review-workspace",
  name: "Design studio",
  slug: "design-studio",
  createdAt: date,
  logo: null,
  metadata: null,
};
const member = {
  id: "ui-review-member",
  organizationId: organization.id,
  userId: user.id,
  role: "owner",
  createdAt: date,
  user,
};

export function fixture(url, method) {
  const p = new URL(url).pathname;
  if (p.endsWith("/get-session"))
    return {
      session: {
        id: "ui-review-session",
        token: "synthetic-session",
        userId: user.id,
        activeOrganizationId: organization.id,
        expiresAt: "2099-01-01T00:00:00.000Z",
        createdAt: date,
        updatedAt: date,
      },
      user,
    };
  if (p.endsWith("/organization/list")) return [organization];
  if (p.endsWith("/organization/get-full-organization"))
    return { ...organization, members: [member], invitations: [] };
  if (p.endsWith("/organization/get-active-member")) return member;
  if (p.endsWith("/organization/get-active-member-role"))
    return { role: "owner" };
  if (p.endsWith("/organization/list-members"))
    return { members: [member], total: 1 };
  if (p.endsWith("/list-accounts"))
    return [
      {
        id: "ui-review-account",
        providerId: "credential",
        accountId: user.id,
        userId: user.id,
        createdAt: date,
        updatedAt: date,
      },
    ];
  if (p.endsWith("/config"))
    return {
      disableRegistration: false,
      disableGuestAccess: false,
      isCloud: false,
      billingEnabled: false,
      isEmailConfigured: false,
      auth: { emailAndPassword: true },
    };
  if (p.endsWith("/has-permission")) return { success: true, error: null };
  if (/\/project\/?$/.test(p)) return [];
  if (/\/label\/workspace\//.test(p)) return [];
  if (/\/billing\/[^/]+$/.test(p))
    return {
      plan: null,
      status: null,
      foundingFree: false,
      currentPeriodEnd: null,
    };
  if (/invitation|notification|api-key|list-sessions/.test(p)) return [];
  if (method !== "GET" && method !== "OPTIONS")
    return { success: true, user, token: null };
  return undefined;
}

export async function installFixtures(context, origin, diagnostics) {
  await context.addInitScript(() => {
    localStorage.setItem("theme", "light");
    localStorage.setItem("vite-ui-theme", "light");
    localStorage.setItem("i18nextLng", "en-US");
    localStorage.setItem(
      "user-preferences",
      JSON.stringify({
        state: { theme: "light", weekStartsOn: 1 },
        version: 0,
      }),
    );
  });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.protocol === "data:" || url.protocol === "blob:")
      return route.continue();
    const isAPI =
      url.pathname.startsWith("/api/") ||
      url.origin === "http://127.0.0.1:4799";
    if (isAPI) {
      if (request.method() === "OPTIONS")
        return route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": origin,
            "access-control-allow-credentials": "true",
            "access-control-allow-headers": "*",
          },
        });
      const data = fixture(request.url(), request.method());
      if (data === undefined)
        diagnostics.unhandled.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({
        status: data === undefined ? 501 : 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-credentials": "true",
        },
        body: JSON.stringify(
          data ?? { error: "No synthetic fixture for this endpoint" },
        ),
      });
    }
    if (url.origin === origin && request.method() === "GET")
      return route.continue();
    diagnostics.blocked.push(url.origin + url.pathname);
    return route.abort();
  });
  await context.routeWebSocket("**/*", (ws) => {
    const url = new URL(ws.url());
    if (url.host === new URL(origin).host) ws.connectToServer();
    else ws.close();
  });
}

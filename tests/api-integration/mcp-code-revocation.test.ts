import { createHash } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import mcp from "../../apps/api/src/mcp";
import {
  createAuthorizationRequest,
  registerClient,
} from "../../apps/api/src/mcp/oauth";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";

const redirectUri = "https://client.example/callback";
const verifier = "session-revocation-test-verifier";
const origin = "http://localhost:5173";

beforeEach(resetTestDatabase);

async function approve() {
  const { app } = createApp();
  const user = await signUpWithSession(app, {
    email: "mcp-user@example.com",
    name: "MCP User",
  });
  const session = await auth.api.getSession({
    headers: new Headers({ cookie: user.cookies }),
  });
  if (!session) throw new Error("Expected the approving session");
  const client = await registerClient({ redirectUris: [redirectUri] });
  const requestId = await createAuthorizationRequest({
    clientId: client.clientId,
    redirectUri,
    codeChallenge: createHash("sha256").update(verifier).digest("base64url"),
  });
  const decision = await mcp.request(`/mcp/authorize/request/${requestId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: user.cookies,
      origin,
    },
    body: JSON.stringify({ approved: true }),
  });
  expect(decision.status).toBe(200);
  const { redirect } = (await decision.json()) as { redirect: string };
  const code = new URL(redirect).searchParams.get("code");
  expect(code).toBeTruthy();
  const redeem = () =>
    mcp.request("/mcp/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code!,
        client_id: client.clientId,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    });
  return { app, user, session: session.session, redeem };
}

describe("MCP authorization session lifetime", () => {
  it("redeems a code approved by a live session and authenticates its token", async () => {
    const { app, redeem } = await approve();
    const response = await redeem();
    expect(response.status).toBe(200);
    const token = (await response.json()) as { access_token: string };
    expect(
      (
        await app.request("/api/workspace", {
          headers: { authorization: `Bearer ${token.access_token}` },
        })
      ).status,
    ).toBe(200);
  });

  it.each(["revoked", "expired", "banned"])(
    "refuses a code when its approving session is %s",
    async (state) => {
      const { user, redeem } = await approve();
      if (state === "revoked") {
        await db
          .delete(schema.sessionTable)
          .where(eq(schema.sessionTable.userId, user.userId));
      } else if (state === "expired") {
        await db
          .update(schema.sessionTable)
          .set({ expiresAt: new Date(Date.now() - 60_000) })
          .where(eq(schema.sessionTable.userId, user.userId));
      } else {
        await db
          .update(schema.userTable)
          .set({ banned: true })
          .where(eq(schema.userTable.id, user.userId));
      }
      const before = await db.select().from(schema.sessionTable);
      const response = await redeem();
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: "invalid_grant" });
      expect(await db.select().from(schema.sessionTable)).toHaveLength(
        before.length,
      );
      expect((await redeem()).status).toBe(400);
    },
  );
});

async function waitForBlockedUserLocks(total: number) {
  await vi.waitFor(
    async () => {
      const result = await getDatabasePool().query<{ total: number }>(`
        SELECT count(*)::integer AS total FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
          AND wait_event_type = 'Lock'
          AND query LIKE '%"user"%'
      `);
      expect(result.rows[0].total).toBe(total);
    },
    { timeout: 5_000, interval: 25 },
  );
}

describe("MCP code redemption and concurrent session revocation", () => {
  for (const operation of [
    "revoke-one",
    "revoke-all",
    "revoke-other",
    "ban",
  ] as const) {
    it.each(["redemption", "revocation"] as const)(
      `${operation} serializes when %s is queued first`,
      async (first) => {
        const { app, user, session, redeem } = await approve();
        // B approved the code; A is the independently authenticated caller
        // whose current session revoke-other must preserve.
        const current =
          operation === "revoke-other"
            ? await auth.api.signInEmail({
                body: {
                  email: "mcp-user@example.com",
                  password: "correct horse battery staple",
                },
              })
            : null;
        if (current) expect(current.token).not.toBe(session.token);
        const admin =
          operation === "ban"
            ? await signUpWithSession(app, {
                email: "administrator@example.com",
                name: "Administrator",
                role: "admin",
              })
            : null;
        const revokePath =
          operation === "ban"
            ? "admin/ban-user"
            : operation === "revoke-all"
              ? "revoke-sessions"
              : operation === "revoke-other"
                ? "revoke-other-sessions"
                : "revoke-session";
        const revoke = () =>
          app.request(`/api/auth/${revokePath}`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(current
                ? { authorization: `Bearer ${current.token}` }
                : { cookie: admin?.cookies ?? user.cookies }),
              origin,
            },
            body: JSON.stringify(
              operation === "ban"
                ? { userId: user.userId }
                : operation === "revoke-one"
                  ? { token: session.token }
                  : {},
            ),
          });
        const blocker = await getDatabasePool().connect();
        const pending: Promise<Response>[] = [];
        try {
          await blocker.query("BEGIN");
          await blocker.query(
            'SELECT id FROM "user" WHERE id = $1 FOR UPDATE',
            [user.userId],
          );
          pending.push(first === "redemption" ? redeem() : revoke());
          await waitForBlockedUserLocks(1);
          pending.push(first === "redemption" ? revoke() : redeem());
          await waitForBlockedUserLocks(2);
          await blocker.query("COMMIT");
          const responses = await Promise.all(pending);
          const redemption = responses[first === "redemption" ? 0 : 1];
          const revocation = responses[first === "redemption" ? 1 : 0];
          expect(revocation.status).toBe(200);
          expect(redemption.status).toBe(first === "redemption" ? 200 : 400);
          const sessions = await db
            .select()
            .from(schema.sessionTable)
            .where(eq(schema.sessionTable.userId, user.userId));
          expect(sessions.some((row) => row.id === session.id)).toBe(false);
          if (operation === "revoke-other") {
            expect(sessions).toEqual([
              expect.objectContaining({ token: current!.token }),
            ]);
            expect(
              (
                await app.request("/api/workspace", {
                  headers: { authorization: `Bearer ${current!.token}` },
                })
              ).status,
            ).toBe(200);
            if (redemption.status === 200) {
              const token = (await redemption.json()) as {
                access_token: string;
              };
              expect(
                (
                  await app.request("/api/workspace", {
                    headers: { authorization: `Bearer ${token.access_token}` },
                  })
                ).status,
              ).toBe(401);
            }
          } else if (operation !== "revoke-one") {
            expect(sessions).toHaveLength(0);
          } else if (redemption.status === 200) {
            const token = (await redemption.json()) as { access_token: string };
            expect(
              sessions.some((row) => row.token === token.access_token),
            ).toBe(true);
          }
        } finally {
          await blocker.query("ROLLBACK");
          blocker.release();
          await Promise.allSettled(pending);
        }
      },
    );
  }

  it.each(["cookie", "bearer", "server"] as const)(
    "preserves the current session through %s revoke-other calls, including expired others",
    async (transport) => {
      const { app, user, session } = await approve();
      const unrelated = await signUpWithSession(app, {
        email: "unrelated@example.com",
        name: "Unrelated User",
      });
      const unrelatedSessions = await db
        .select()
        .from(schema.sessionTable)
        .where(eq(schema.sessionTable.userId, unrelated.userId));
      const second = await auth.api.signInEmail({
        body: {
          email: "mcp-user@example.com",
          password: "correct horse battery staple",
        },
      });
      await db
        .update(schema.sessionTable)
        .set({ expiresAt: new Date(Date.now() - 60_000) })
        .where(
          and(
            eq(schema.sessionTable.userId, user.userId),
            ne(schema.sessionTable.token, session.token),
          ),
        );
      expect(second.token).not.toBe(session.token);
      const headers = new Headers(
        transport === "bearer"
          ? { authorization: `Bearer ${session.token}` }
          : { cookie: user.cookies },
      );
      if (transport === "server") {
        expect(await auth.api.revokeOtherSessions({ headers })).toEqual({
          status: true,
        });
      } else {
        headers.set("origin", origin);
        const response = await app.request("/api/auth/revoke-other-sessions", {
          method: "POST",
          headers,
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ status: true });
      }
      const sessions = await db
        .select()
        .from(schema.sessionTable)
        .where(eq(schema.sessionTable.userId, user.userId));
      expect(sessions).toEqual([expect.objectContaining({ id: session.id })]);
      expect(
        await db
          .select()
          .from(schema.sessionTable)
          .where(eq(schema.sessionTable.userId, unrelated.userId)),
      ).toEqual(unrelatedSessions);
    },
  );
});

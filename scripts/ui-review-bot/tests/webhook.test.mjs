import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { authorizeRequest } from "../request.mjs";
import { handleWebhook } from "../worker/index.mjs";

const secret = "unit-test-webhook-secret";
const event = {
  repository: { full_name: "usekaneo/kaneo" },
  installation: { id: 162493570 },
  action: "created",
  issue: { number: 1720, pull_request: {} },
  comment: {
    id: 456,
    body: "/peekareq",
    user: { login: "tinsever", type: "User" },
  },
};
function request(payload = event, signature = true, kind = "issue_comment") {
  const body = JSON.stringify(payload);
  return new Request("https://example.test/webhook", {
    method: "POST",
    body,
    headers: {
      "x-github-event": kind,
      "x-hub-signature-256": signature
        ? `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`
        : "sha256=invalid",
    },
  });
}
function setup(permission = "write", commandBody = "/peekareq") {
  const writes = [];
  let tokens = 0;
  const ids = new Set();
  const env = {
    WEBHOOK_SECRET: secret,
    INSTALLATION_ID: "162493570",
    DB: {
      prepare: () => ({
        bind: (id) => ({
          run: async () => {
            const changes = ids.has(id) ? 0 : 1;
            ids.add(id);
            return { meta: { changes } };
          },
        }),
      }),
    },
  };
  const api = async (endpoint, body) => {
    if (endpoint.endsWith("/comments/456"))
      return {
        ...event.comment,
        body: commandBody,
        issue_url: "https://api.github.com/repos/usekaneo/kaneo/issues/1720",
      };
    if (endpoint.endsWith("/permission")) return { permission };
    if (endpoint.endsWith("/pulls/1720"))
      return { state: "open", base: { repo: event.repository } };
    if (endpoint.endsWith("/dispatches")) {
      writes.push(body);
      return null;
    }
    throw Error("Unexpected API call");
  };
  return {
    env,
    dependencies: {
      token: async () => {
        tokens++;
        return "fake";
      },
      api,
    },
    writes,
    tokens: () => tokens,
  };
}

test("ordinary comments, bot comments, edits and other events cause zero GitHub calls", async () => {
  const s = setup();
  for (const payload of [
    { ...event, comment: { ...event.comment, body: "Looks good" } },
    { ...event, action: "edited" },
    {
      ...event,
      comment: { ...event.comment, user: { login: "bot", type: "Bot" } },
    },
    { ...event, issue: { number: 1720 } },
  ]) {
    assert.equal(
      (await handleWebhook(request(payload), s.env, s.dependencies)).status,
      200,
    );
  }
  assert.equal(
    (await handleWebhook(request(event, true, "push"), s.env, s.dependencies))
      .status,
    200,
  );
  assert.equal(s.tokens(), 0);
  assert.equal(s.writes.length, 0);
});

test("/peekareview routes only its own live maintainer command and is deduplicated", async () => {
  const payload = {
    ...event,
    comment: { ...event.comment, body: "/peekareview" },
  };
  const s = setup("maintain", "/peekareview");
  await Promise.all([
    handleWebhook(request(payload), s.env, s.dependencies),
    handleWebhook(request(payload), s.env, s.dependencies),
  ]);
  assert.deepEqual(s.writes, [
    {
      event_type: "peekareview",
      client_payload: { pr: 1720, comment_id: 456 },
    },
  ]);
  const denied = setup("read", "/peekareview");
  await handleWebhook(request(payload), denied.env, denied.dependencies);
  assert.equal(denied.writes.length, 0);
  const changed = setup("write", "/peekareq");
  await handleWebhook(request(payload), changed.env, changed.dependencies);
  assert.equal(changed.writes.length, 0);
  const ignored = setup();
  for (const body of [
    "/peekareview please",
    "> /peekareview",
    "constructor",
    "/peekareview\n/peekareq",
  ])
    await handleWebhook(
      request({ ...payload, comment: { ...payload.comment, body } }),
      ignored.env,
      ignored.dependencies,
    );
  assert.equal(ignored.tokens(), 0);
});

test("invalid signatures and wrong installations cannot dispatch", async () => {
  const s = setup();
  assert.equal(
    (await handleWebhook(request(event, false), s.env, s.dependencies)).status,
    401,
  );
  assert.equal(
    (
      await handleWebhook(
        request({ ...event, installation: { id: 1 } }),
        s.env,
        s.dependencies,
      )
    ).status,
    403,
  );
  assert.equal(s.tokens(), 0);
});

test("only maintainers dispatch and concurrent redeliveries dispatch once", async () => {
  const denied = setup("read");
  await handleWebhook(request(), denied.env, denied.dependencies);
  assert.equal(denied.writes.length, 0);
  const s = setup();
  const results = await Promise.all([
    handleWebhook(request(), s.env, s.dependencies),
    handleWebhook(request(), s.env, s.dependencies),
  ]);
  assert.ok(results.every((r) => r.status === 200));
  assert.deepEqual(s.writes, [
    { event_type: "peekareq", client_payload: { pr: 1720, comment_id: 456 } },
  ]);
});

test("Actions rechecks dispatched comment authors and rejects spoofed dispatchers", async () => {
  const payload = {
    action: "peekareq",
    repository: event.repository,
    sender: { login: "peekareq[bot]", type: "Bot" },
    client_payload: { pr: 1720, comment_id: 456 },
  };
  assert.equal(
    (
      await authorizeRequest(
        "repository_dispatch",
        payload,
        setup().dependencies.api,
      )
    ).allowed,
    true,
  );
  assert.equal(
    (
      await authorizeRequest(
        "repository_dispatch",
        payload,
        setup("read").dependencies.api,
      )
    ).allowed,
    false,
  );
  assert.equal(
    (
      await authorizeRequest(
        "repository_dispatch",
        { ...payload, sender: { login: "tinsever", type: "User" } },
        setup().dependencies.api,
      )
    ).allowed,
    false,
  );
});

test("default Worker path signs an App JWT and uses an edge-compatible redirect policy", async (t) => {
  const s = setup();
  const keys = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const der = await crypto.subtle.exportKey("pkcs8", keys.privateKey);
  s.env.APP_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(der).toString("base64")}\n-----END PRIVATE KEY-----`;
  s.env.APP_CLIENT_ID = "test-app";
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(options.redirect, "manual");
    const endpoint = String(url).replace("https://api.github.com/", "");
    if (endpoint.endsWith("/access_tokens")) {
      const jwt = options.headers.Authorization.slice(7).split(".");
      assert.equal(
        await crypto.subtle.verify(
          "RSASSA-PKCS1-v1_5",
          keys.publicKey,
          Buffer.from(jwt[2], "base64url"),
          Buffer.from(jwt.slice(0, 2).join(".")),
        ),
        true,
      );
      return Response.json({ token: "test-installation-token" });
    }
    assert.equal(
      options.headers.Authorization,
      "Bearer test-installation-token",
    );
    const result = await s.dependencies.api(
      endpoint,
      options.body ? JSON.parse(options.body) : undefined,
    );
    return result === null
      ? new Response(null, { status: 204 })
      : Response.json(result);
  });
  assert.equal((await handleWebhook(request(), s.env)).status, 200);
  assert.equal(s.writes.length, 1);
});

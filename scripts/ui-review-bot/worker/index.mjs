import { REPO } from "../identity.mjs";
import { authorizeRequest, commandName } from "../request-policy.mjs";
import { reviewModel } from "./review-model.mjs";

const encoder = new TextEncoder();
const response = (status, result) => Response.json({ result }, { status });

async function boundedBody(message, limit) {
  const reader = message.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error("body_limit");
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

async function validSignature(bytes, signature, secret) {
  if (!secret || !/^sha256=[0-9a-f]{64}$/.test(signature || "")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const digest = Uint8Array.from(signature.slice(7).match(/../g), (hex) =>
    Number.parseInt(hex, 16),
  );
  return crypto.subtle.verify("HMAC", key, digest, bytes);
}

const base64url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
async function appJWT(env) {
  const der = Uint8Array.from(
    atob(env.APP_PRIVATE_KEY.replace(/-----[^-]+-----|\s/g, "")),
    (char) => char.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const unsigned = [
    { alg: "RS256", typ: "JWT" },
    { iss: env.APP_CLIENT_ID, iat: now - 60, exp: now + 540 },
  ]
    .map((value) => base64url(encoder.encode(JSON.stringify(value))))
    .join(".");
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(unsigned),
  );
  return `${unsigned}.${base64url(new Uint8Array(signature))}`;
}

async function github(endpoint, token, signal, body) {
  const result = await fetch(`https://api.github.com/${endpoint}`, {
    method: body ? "POST" : "GET",
    signal,
    redirect: "manual",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "peekareq-webhook",
      "X-GitHub-Api-Version": "2026-03-10",
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!result.ok) {
    await result.body?.cancel();
    throw new Error(`github_${result.status}`);
  }
  if (result.status === 204) return null;
  return JSON.parse(
    new TextDecoder().decode(await boundedBody(result, 1_000_000)),
  );
}

export async function handleWebhook(request, env, dependencies = {}) {
  if (new URL(request.url).pathname !== "/webhook")
    return response(404, "not_found");
  if (request.method !== "POST") return response(405, "method_not_allowed");
  let bytes;
  try {
    bytes = await boundedBody(request, 256_000);
  } catch {
    return response(413, "payload_too_large");
  }
  if (
    !(await validSignature(
      bytes,
      request.headers.get("x-hub-signature-256"),
      env.WEBHOOK_SECRET,
    ))
  )
    return response(401, "invalid_signature");
  const eventName = request.headers.get("x-github-event");
  if (eventName === "ping") return response(200, "pong");
  if (eventName !== "issue_comment") return response(200, "ignored");
  let event;
  try {
    event = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return response(400, "invalid_json");
  }
  if (
    event?.repository?.full_name !== REPO ||
    event.action !== "created" ||
    !event.issue?.pull_request ||
    event.comment?.user?.type !== "User" ||
    typeof event.comment?.body !== "string" ||
    !commandName(event.comment.body)
  )
    return response(200, "ignored");
  if (String(event.installation?.id) !== env.INSTALLATION_ID)
    return response(403, "wrong_installation");
  const signal = AbortSignal.timeout(8_000);
  let claimed = false;
  let stage = "token";
  try {
    const token = await (
      dependencies.token ||
      (async () => {
        const installation = await github(
          `app/installations/${env.INSTALLATION_ID}/access_tokens`,
          await appJWT(env),
          signal,
          {
            repositories: ["kaneo"],
            permissions: { contents: "write", pull_requests: "read" },
          },
        );
        return installation.token;
      })
    )();
    const api =
      dependencies.api ||
      ((endpoint, body) => github(endpoint, token, signal, body));
    stage = "authorize";
    const decision = await authorizeRequest(
      eventName,
      event,
      api,
      commandName(event.comment.body),
    );
    if (!decision.allowed) return response(200, "ignored");
    stage = "claim";
    const claim = await env.DB.prepare(
      "INSERT OR IGNORE INTO commands (comment_id, created_at) VALUES (?, ?)",
    )
      .bind(event.comment.id, new Date().toISOString())
      .run();
    if (!claim.meta.changes) return response(200, "duplicate");
    claimed = true;
    stage = "dispatch";
    await api(`repos/${REPO}/dispatches`, {
      event_type: decision.command,
      client_payload: { pr: decision.pr, comment_id: event.comment.id },
    });
    return response(200, "dispatched");
  } catch (error) {
    // A timed-out dispatch may already have reached GitHub; never dispatch it twice.
    console.error(
      JSON.stringify({
        event: "webhook_failed",
        stage,
        error_type: error.name,
        comment_id: event.comment.id,
        claimed,
        code: /^github_\d+$/.test(error.message)
          ? error.message
          : "request_failed",
      }),
    );
    return response(502, "request_failed");
  }
}

export default {
  fetch: (request, env) =>
    new URL(request.url).pathname === "/review-model"
      ? reviewModel(request, env)
      : handleWebhook(request, env),
};

import { timingSafeEqual } from "node:crypto";
import { MODEL, PRICES, reservation } from "../code-review/limits.mjs";

import { matchesSchema, responseFormat } from "../code-review/schema.mjs";

const encoder = new TextEncoder();
const fail = (status, error) => Response.json({ error }, { status });

export async function boundedJSON(message, limit) {
  const reader = message.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error("Body too large");
    }
    text += decoder.decode(value, { stream: true });
  }
  return JSON.parse(text + decoder.decode());
}

export async function reviewModel(request, env, fetcher = fetch) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (
    !/^[a-f0-9]{64}$/.test(token || "") ||
    !/^[a-f0-9]{64}$/.test(env.REVIEW_PROXY_TOKEN || "") ||
    !timingSafeEqual(
      encoder.encode(token),
      encoder.encode(env.REVIEW_PROXY_TOKEN),
    )
  )
    return fail(401, "Unauthorized");
  if (request.method !== "POST") return fail(405, "Method not allowed");
  if (!env.OPENROUTER_API_KEY)
    return fail(503, "Review provider is not configured");
  const attempt = request.headers.get("x-peekareview-attempt");
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(attempt || ""))
    return fail(400, "Invalid review attempt");
  let input;
  let reserved;
  let format;
  try {
    input = await boundedJSON(request, 190_000);
    if (
      input.model !== MODEL ||
      !Array.isArray(input.messages) ||
      input.messages.length !== 2 ||
      input.messages[0].role !== "system" ||
      input.messages[1].role !== "user" ||
      input.messages.some((m) => typeof m.content !== "string")
    )
      return fail(400, "Unsupported review request");
    format = responseFormat(input.response_format?.json_schema?.name);
    reserved = Math.ceil(reservation(input.messages, 8192, format) * 1e6);
  } catch {
    return fail(400, "Invalid review request");
  }
  const body = {
    model: MODEL,
    messages: input.messages.map(({ role, content }) => ({ role, content })),
    max_tokens: 8192,
    reasoning: { enabled: true, effort: "medium", exclude: true },
    response_format: format,
    provider: {
      sort: "throughput",
      require_parameters: true,
      max_price: PRICES,
    },
  };
  const serialized = JSON.stringify(body);
  const contentHash = Buffer.from(
    await crypto.subtle.digest("SHA-256", encoder.encode(serialized)),
  ).toString("hex");
  const hash = `${contentHash}.${attempt}`;
  const cached =
    (await env.DB.prepare(
      "SELECT status, response FROM review_requests WHERE status = 'complete' AND (hash = ? OR hash GLOB ?) LIMIT 1",
    )
      .bind(contentHash, `${contentHash}.*`)
      .first()) ||
    (await env.DB.prepare(
      "SELECT status, response FROM review_requests WHERE hash = ?",
    )
      .bind(hash)
      .first());
  if (cached) {
    if (cached.status !== "complete")
      return fail(409, "Prior request unresolved; no automatic retry");
    const result = JSON.parse(cached.response);
    return Response.json({
      ...result,
      usage: { ...result.usage, cost: 0 },
      peekareview_cached: true,
    });
  }
  // A single conditional write checks the shared ledger and reserves before inference.
  const claim = await env.DB.prepare(`
    INSERT OR IGNORE INTO review_requests (hash, reserved, charged, status)
    SELECT ?, ?, ?, 'reserved'
    FROM review_budget WHERE id = 1 AND halted = 0
      AND initial_spend + COALESCE((SELECT SUM(charged) FROM review_requests), 0) + ? <= ceiling
  `)
    .bind(hash, reserved, reserved, reserved)
    .run();
  if (!claim.meta.changes)
    return fail(429, "Review budget exhausted or request already reserved");
  try {
    const response = await fetcher(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(180_000),
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "X-OpenRouter-Title": "Peekareview",
        },
        body: serialized,
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      return fail(502, "Provider failed; maximum cost remains reserved");
    }
    const result = await boundedJSON(response, 200_000);
    const cost = result.usage?.cost;
    if (!Number.isFinite(cost) || cost < 0)
      return fail(502, "Provider cost unavailable; maximum remains reserved");
    const charged = Math.ceil(cost * 1.15 * 1e6);
    let complete =
      !result.error &&
      result.choices?.[0]?.finish_reason === "stop" &&
      typeof result.choices[0].message?.content === "string";
    if (complete) {
      try {
        complete = matchesSchema(
          JSON.parse(result.choices[0].message.content),
          format.json_schema.schema,
        );
      } catch {
        complete = false;
      }
    }
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE review_requests SET charged = ?, status = ?, response = ? WHERE hash = ? AND status = 'reserved'",
      ).bind(
        charged,
        complete && charged <= reserved ? "complete" : "failed",
        complete ? JSON.stringify(result) : null,
        hash,
      ),
      env.DB.prepare(
        "UPDATE review_budget SET halted = 1 WHERE id = 1 AND ? > ?",
      ).bind(charged, reserved),
    ]);
    if (charged > reserved)
      return fail(502, "Provider exceeded reservation; budget halted");
    return Response.json(result);
  } catch {
    return fail(502, "Request unresolved; maximum cost remains reserved");
  }
}

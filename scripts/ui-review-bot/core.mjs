import { execFile } from "node:child_process";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const DATA = path.join(ROOT, ".cache/ui-review-bot");
export { prNumber, REPO } from "./identity.mjs";

import { prNumber, REPO } from "./identity.mjs";

const exec = promisify(execFile);

export async function command(bin, args, options = {}) {
  const result = await exec(bin, args, {
    cwd: ROOT,
    timeout: 120_000,
    maxBuffer: 12 * 1024 * 1024,
    ...options,
  });
  return result.stdout.trim();
}

export async function getPR(value) {
  return JSON.parse(
    await command("gh", [
      "pr",
      "view",
      String(prNumber(value)),
      "--repo",
      REPO,
      "--json",
      "number,title,body,url,files,baseRefOid,headRefOid",
    ]),
  );
}

export function localPath(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    throw new Error("The model returned an invalid application path.");
  const url = new URL(value, "http://app.local");
  if (url.origin !== "http://app.local" || url.pathname.startsWith("/api"))
    throw new Error("Only application pages may be visited.");
  return url.pathname + url.search;
}

export function parseJSON(content) {
  if (typeof content !== "string")
    throw new Error("The model returned no text. Try another model.");
  return JSON.parse(
    content.replace(/^\s*```(?:json)?\s*/, "").replace(/\s*```\s*$/, ""),
  );
}

export function validateTarget(target) {
  if (
    !target ||
    !["role", "label", "placeholder", "text"].includes(target.by) ||
    typeof target.name !== "string" ||
    !target.name.trim() ||
    target.name.length > 200
  )
    throw new Error("Invalid screenshot target.");
  return {
    by: target.by,
    name: target.name,
    role: String(target.role || "button").slice(0, 30),
  };
}

export function validatePlan(plan) {
  if (!Array.isArray(plan.scenarios) || !plan.scenarios.length)
    throw new Error("The model did not return any scenarios.");
  return {
    summary: String(plan.summary || "AI-selected UI scenarios").slice(0, 1500),
    scenarios: plan.scenarios.slice(0, 3).map((s, i) => ({
      name: String(s.name || `Scenario ${i + 1}`).slice(0, 120),
      reason: String(s.reason || "").slice(0, 1500),
      beforePath: localPath(s.beforePath),
      afterPath: localPath(s.afterPath),
      ...(s.focus ? { focus: validateTarget(s.focus) } : {}),
      visible: (Array.isArray(s.visible) ? s.visible : [])
        .slice(0, 6)
        .map(validateTarget),
      actions: (Array.isArray(s.actions) ? s.actions : [])
        .slice(0, 6)
        .map((a) => {
          if (!["click", "fill", "press"].includes(a.type))
            throw new Error("Unsupported browser action.");
          if (!["role", "label", "placeholder", "text"].includes(a.by))
            throw new Error("Unsupported element locator.");
          if (typeof a.name !== "string" || !a.name || a.name.length > 200)
            throw new Error("Invalid element name.");
          if (
            a.type === "press" &&
            !["Tab", "Enter", "Escape", "ArrowDown", "ArrowUp"].includes(
              a.value,
            )
          )
            throw new Error("Unsupported key.");
          return {
            type: a.type,
            by: a.by,
            name: a.name,
            role: String(a.role || "button").slice(0, 30),
            value: String(a.value || "").slice(0, 200),
            only: a.only === "after" ? "after" : "both",
          };
        }),
    })),
  };
}

export function samplePlan() {
  const info = "/dashboard/settings/account/information";
  const security = "/dashboard/settings/account/security";
  return validatePlan({
    summary:
      "Deterministic capture of PR #1719: account navigation and the new Security page. No AI was used in this capture-only run.",
    scenarios: [
      {
        name: "Account navigation",
        reason:
          "Compare the same account page to reveal the new Security navigation item.",
        beforePath: info,
        afterPath: info,
        actions: [],
      },
      {
        name: "New Security page",
        reason:
          "The Security route is new. Compare the existing account page with the added page; pixel differences are expected and are not a regression score.",
        beforePath: info,
        afterPath: security,
        actions: [],
      },
      {
        name: "Password validation",
        reason:
          "Show the added form with invalid input. The base revision has no corresponding form.",
        beforePath: info,
        afterPath: security,
        actions: [
          {
            type: "fill",
            by: "placeholder",
            name: "Enter your current password",
            value: "OldExample123!",
            only: "after",
          },
          {
            type: "fill",
            by: "placeholder",
            name: "Enter a new password",
            value: "NewExample123!",
            only: "after",
          },
          {
            type: "fill",
            by: "placeholder",
            name: "Re-enter your new password",
            value: "DifferentExample123!",
            only: "after",
          },
          {
            type: "click",
            by: "role",
            role: "button",
            name: "Update password",
            only: "after",
          },
        ],
      },
    ],
  });
}

export async function getModels() {
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok)
    throw new Error("Could not load the OpenRouter model catalog.");
  const { data } = await response.json();
  return data
    .filter(
      (m) =>
        m.architecture?.input_modalities?.includes("image") &&
        m.architecture?.output_modalities?.includes("text") &&
        !m.id.includes(":batch"),
    )
    .map((m) => ({
      id: m.id,
      name: m.name,
      input: Number(m.pricing.prompt) * 1e6,
      output: Number(m.pricing.completion) * 1e6,
      reasoning: m.reasoning,
    }))
    .sort((a, b) => a.input - b.input);
}

export async function completion({
  token,
  model,
  messages,
  run,
  signal,
  maxTokens = 2500,
}) {
  const fallback =
    model === "qwen/qwen3.8-flash" ? "google/gemini-2.5-flash-lite" : null;
  let requestModel = fallback && run.providerFallback ? fallback : model;
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (run.calls >= 5)
      throw new Error("The five-call limit for this run was reached.");
    run.calls++;
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-OpenRouter-Title": "Kaneo UI Review - Local",
      },
      body: JSON.stringify({
        model: requestModel,
        messages,
        max_tokens: maxTokens,
        temperature: 0.1,
        ...(run.reasoning && requestModel === model
          ? { reasoning: run.reasoning }
          : {}),
        response_format: { type: "json_object" },
        provider: { require_parameters: true },
      }),
    });
    if (
      ![429, 502, 503, 504].includes(response.status) ||
      attempt === 2 ||
      run.calls >= 5
    )
      break;
    const retryAfter = response.headers?.get("retry-after");
    const seconds =
      retryAfter === null || retryAfter === undefined
        ? Number.NaN
        : Number(retryAfter);
    const wait =
      Number.isFinite(seconds) && seconds >= 0
        ? seconds * 1000
        : 2000 * 2 ** attempt;
    if (wait > 30000) break;
    if (fallback) requestModel = fallback;
    await response.body?.cancel();
    await delay(wait, undefined, { signal });
  }
  const data = await response.json();
  if (!response.ok || data.error) {
    const code = data.error?.code || response.status;
    // Do not echo upstream error bodies: these may contain request content.
    throw new Error(
      `OpenRouter request failed (${code}). Check token credits, model access, or choose a different model.`,
    );
  }
  if (requestModel === fallback) run.providerFallback = true;
  const servedModel =
    typeof data.model === "string" &&
    /^[a-zA-Z0-9][a-zA-Z0-9/_.:@~-]{0,119}$/.test(data.model)
      ? data.model
      : requestModel;
  run.modelsUsed = [...new Set([...(run.modelsUsed || []), servedModel])];
  run.usage.input += data.usage?.prompt_tokens || 0;
  run.usage.output += data.usage?.completion_tokens || 0;
  if (Number.isFinite(data.usage?.cost)) run.usage.cost += data.usage.cost;
  else run.usage.costKnown = false;
  if (data.choices?.[0]?.finish_reason === "length")
    throw new Error(
      "The model exhausted its output allowance. Reduce its reasoning budget or use another model.",
    );
  return parseJSON(data.choices?.[0]?.message?.content);
}

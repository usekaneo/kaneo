import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseJSON } from "../core.mjs";
import { Budget, PRICES, reservation } from "./budget.mjs";

import { MODEL } from "./limits.mjs";
import { responseFormat, validateResponse } from "./schema.mjs";

export { MODEL } from "./limits.mjs";

export class ReviewerModel {
  constructor({
    key,
    model = MODEL,
    cache,
    budget = new Budget(),
    fetcher = fetch,
    endpoint = "https://openrouter.ai/api/v1/chat/completions",
    deadline = Date.now() + 12 * 60_000,
  }) {
    Object.assign(this, {
      key,
      model,
      cache,
      budget,
      fetcher,
      endpoint,
      deadline,
    });
    this.calls = [];
    this.attempt = randomUUID();
  }

  async ask(system, input, label) {
    const messages = [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(input) },
    ];
    const body = {
      model: this.model,
      messages,
      max_tokens: 8192,
      reasoning: { enabled: true, effort: "medium", exclude: true },
      response_format: responseFormat(label),
      provider: {
        sort: "throughput",
        require_parameters: true,
        max_price: PRICES,
      },
    };
    const hash = createHash("sha256")
      .update(JSON.stringify(body))
      .digest("hex");
    const file = path.join(this.cache, `${hash}.json`);
    try {
      const cached = JSON.parse(await readFile(file, "utf8"));
      this.calls.push({ ...cached.meta, cached: true, billedNow: 0 });
      return validateResponse(cached.result, label);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const remaining = this.deadline - Date.now();
    if (remaining <= 0)
      throw new Error("Review deadline reached; no request sent.");
    const maximum = reservation(
      messages,
      body.max_tokens,
      body.response_format,
    );
    const spent = this.calls.reduce(
      (sum, call) =>
        sum +
        (Number.isFinite(call.billedNow)
          ? call.billedNow * 1.15
          : Number.POSITIVE_INFINITY),
      0,
    );
    if (spent + maximum > 0.1)
      throw new Error("Review reached its $0.10 limit; no request sent");
    const id = await this.budget.reserve(maximum, label);
    const pending = { model: this.model, billedNow: null, label };
    this.calls.push(pending);
    // No automatic retries: timeouts may already have incurred a charge.
    const response = await this.fetcher(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
        "X-Peekareview-Attempt": this.attempt,
        "X-OpenRouter-Title": "Peekareq code review beta",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Math.min(180_000, remaining)),
      redirect: "error",
    });
    if (!response.ok) {
      await response.body?.cancel();
      const error = new Error(
        `Model request failed (${response.status}); maximum cost remains reserved.`,
      );
      error.code = "MODEL_HTTP_ERROR";
      error.status = response.status;
      throw error;
    }
    const data = await response.json();
    const settled = await this.budget.settle(
      id,
      data.usage,
      data.model || this.model,
    );
    const meta = {
      model: data.model || this.model,
      cost: settled.reported ?? null,
      billedNow: settled.reported ?? null,
      label,
      id: data.id,
    };
    Object.assign(pending, meta);
    if ((await this.budget.status()).halted)
      throw new Error(
        "Provider exceeded reserved pricing; further requests halted.",
      );
    if (data.error || data.choices?.[0]?.finish_reason !== "stop")
      throw new Error("Incomplete model response; review is inconclusive.");
    const result = validateResponse(
      parseJSON(data.choices[0].message.content),
      label,
    );
    await mkdir(this.cache, { recursive: true });
    await writeFile(file, JSON.stringify({ result, meta }), { mode: 0o600 });
    return result;
  }
}

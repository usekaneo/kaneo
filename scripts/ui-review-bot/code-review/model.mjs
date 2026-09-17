import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseJSON } from "../core.mjs";
import { Budget, PRICES, reservation } from "./budget.mjs";

export const MODEL = "deepseek/deepseek-v4-flash";

export class ReviewerModel {
  constructor({
    key,
    model = MODEL,
    cache,
    budget = new Budget(),
    fetcher = fetch,
  }) {
    Object.assign(this, { key, model, cache, budget, fetcher });
    this.calls = [];
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
      reasoning: { enabled: true, effort: "low", exclude: true },
      response_format: { type: "json_object" },
      provider: { sort: "price", require_parameters: true, max_price: PRICES },
    };
    const hash = createHash("sha256")
      .update(JSON.stringify(body))
      .digest("hex");
    const file = path.join(this.cache, `${hash}.json`);
    try {
      const cached = JSON.parse(await readFile(file, "utf8"));
      this.calls.push({ ...cached.meta, cached: true, billedNow: 0 });
      return cached.result;
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const id = await this.budget.reserve(
      reservation(messages, body.max_tokens),
      label,
    );
    // No automatic retries: timeouts may already have incurred a charge.
    const response = await this.fetcher(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
          "X-OpenRouter-Title": "Peekareq code review beta",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
        redirect: "error",
      },
    );
    if (!response.ok)
      throw new Error(
        `Model request failed (${response.status}); maximum cost remains reserved.`,
      );
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
    this.calls.push(meta);
    if ((await this.budget.status()).halted)
      throw new Error(
        "Provider exceeded reserved pricing; further requests halted.",
      );
    if (data.error || data.choices?.[0]?.finish_reason !== "stop")
      throw new Error("Incomplete model response; review is inconclusive.");
    const result = parseJSON(data.choices[0].message.content);
    await mkdir(this.cache, { recursive: true });
    await writeFile(file, JSON.stringify({ result, meta }), { mode: 0o600 });
    return result;
  }
}

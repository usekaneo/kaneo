import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { DATA, getModels, prNumber } from "./core.mjs";
import { publishReport } from "./publish.mjs";
import { executeRun } from "./runner.mjs";

export function readKey(text) {
  const match = text.match(
    /^\s*(?:export\s+)?(?:API_KEY|OPENROUTER_API_KEY)\s*=\s*(.*?)\s*$/m,
  );
  if (!match)
    throw new Error(
      "The env file must contain API_KEY=… or OPENROUTER_API_KEY=….",
    );
  let value = match[1].trim();
  if (value.startsWith('"') || value.startsWith("'")) {
    const end = value.indexOf(value[0], 1);
    if (end === -1) throw new Error("The API key has an unclosed quote.");
    value = value.slice(1, end);
  } else value = value.replace(/\s+#.*$/, "").trim();
  if (value.length < 15) throw new Error("The API key is missing or empty.");
  return value;
}

export function cliOptions(args) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      help: { type: "boolean" },
      model: { type: "string", default: "qwen/qwen3.8-flash" },
      "key-file": {
        type: "string",
        default: path.join(homedir(), ".env.openroutercopythis"),
      },
      "capture-only": { type: "boolean" },
      "no-post": { type: "boolean" },
    },
  });
  if (values.help) return { help: true };
  if (positionals.length !== 1)
    throw new Error(
      "Provide exactly one PR number or URL. Use --help for usage.",
    );
  return {
    number: prNumber(positionals[0]),
    mode: values["capture-only"] ? "capture" : "ai",
    model: values.model,
    keyFile: values["key-file"].replace(/^~\//, `${homedir()}/`),
    post: !values["no-post"],
  };
}

async function main() {
  const options = cliOptions(process.argv.slice(2));
  if (options.help) {
    console.log(
      "Usage: npm start -- <PR number or URL> [--model qwen/qwen3.8-flash] [--key-file ~/.env.openroutercopythis] [--capture-only] [--no-post]\nUploads PR screenshots and posts a table automatically. Use --no-post for a local-only run.",
    );
    return;
  }
  const { number, mode, model, keyFile } = options;
  let token = "";
  let reasoning;
  if (mode === "ai") {
    token = readKey(await readFile(keyFile, "utf8"));
    const models = await getModels();
    const selected = models.find((m) => m.id === model);
    if (!selected)
      throw new Error("Model is unavailable or does not support image input.");
    if (selected.reasoning?.supports_max_tokens)
      reasoning = { max_tokens: 512, exclude: true };
    else if (selected.reasoning?.supported_efforts?.includes("low"))
      reasoning = { effort: "low", exclude: true };
    else if (selected.reasoning && !selected.reasoning.mandatory)
      reasoning = { enabled: false };
    const check = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!check.ok) throw new Error("OpenRouter rejected the API key.");
    console.log(`OpenRouter connected · ${model} · PR #${number}`);
  }
  const run = {
    id: randomUUID(),
    prNumber: number,
    mode,
    model,
    reasoning,
    status: "running",
    phase: "queued",
    startedAt: new Date().toISOString(),
    calls: 0,
    usage: { input: 0, output: 0, cost: 0, costKnown: true },
    events: [],
    results: [],
  };
  await mkdir(DATA, { recursive: true });
  const controller = new AbortController();
  const cancel = () => controller.abort(new Error("Review cancelled."));
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  let events = 0;
  await executeRun(run, token, controller.signal, () => {
    for (const event of run.events.slice(events))
      console.log(`[${run.phase}] ${event.message}`);
    events = run.events.length;
  });
  token = "";
  process.removeListener("SIGINT", cancel);
  process.removeListener("SIGTERM", cancel);
  console.log(
    `\nStatus: ${run.status}\nReport: ${path.join(DATA, "runs", run.id, "report.json")}\nScreenshots: ${run.results.length} pairs\nModel calls: ${run.calls}\nTokens: ${run.usage.input} input / ${run.usage.output} output\nReported model cost: ${run.usage.costKnown ? `$${run.usage.cost.toFixed(5)}` : `unavailable (partial: $${run.usage.cost.toFixed(5)})`}`,
  );
  if (options.post && ["complete", "partial"].includes(run.status)) {
    console.log(
      `GitHub comment: ${await publishReport(run, { folder: path.join(DATA, "runs", run.id) })}`,
    );
  }
  process.exitCode = run.status === "complete" ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });

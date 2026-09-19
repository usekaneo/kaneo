import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { readKey } from "../cli.mjs";
import { command, ROOT } from "../core.mjs";
import { prNumber, REPO } from "../identity.mjs";
import { Budget } from "./budget.mjs";
import { Snapshot } from "./context.mjs";
import { MODEL, ReviewerModel } from "./model.mjs";
import { markdown, review } from "./review.mjs";

export async function prSnapshot(number) {
  const pr = JSON.parse(
    await command("gh", ["api", `repos/${REPO}/pulls/${prNumber(number)}`]),
  );
  await command("git", [
    "fetch",
    "origin",
    `pull/${pr.number}/head`,
    pr.base.sha,
  ]);
  const base = await command("git", ["merge-base", pr.base.sha, pr.head.sha]);
  return { base, head: pr.head.sha, targetBase: pr.base.sha, pr: pr.number };
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      base: { type: "string" },
      head: { type: "string" },
      model: { type: "string", default: MODEL },
      output: { type: "string" },
      budget: { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  const budget = new Budget();
  if (values.budget) {
    console.log(JSON.stringify(await budget.status(), null, 2));
    return;
  }
  if (values.help) {
    console.log(
      "Usage: node scripts/ui-review-bot/code-review/cli.mjs <PR> | --base SHA --head SHA [--model ID] [--output DIR]\nPrivate review; no GitHub writes. Reads source without executing PR code. --budget shows the shared $0.85 development ledger.",
    );
    return;
  }
  const proxy = process.env.PEEKAREVIEW_MODEL_URL;
  const proxyToken = process.env.PEEKAREVIEW_PROXY_TOKEN;
  if (proxy || proxyToken || process.env.GITHUB_ACTIONS === "true") {
    const url = proxy && new URL(proxy);
    if (
      !proxyToken ||
      !/^[a-f0-9]{64}$/.test(proxyToken) ||
      !url ||
      url.protocol !== "https:" ||
      !url.hostname.endsWith(".workers.dev") ||
      url.pathname !== "/review-model" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error(
        "Configure the private review proxy before running in Actions",
      );
  }
  if (
    positionals.length > 1 ||
    (positionals.length && (values.base || values.head))
  )
    throw new Error("Choose a PR or a base/head pair.");
  const refs = positionals.length
    ? await prSnapshot(positionals[0])
    : { base: values.base, head: values.head };
  const snapshot = new Snapshot(ROOT, refs.base, refs.head);
  const root = path.join(ROOT, ".cache/code-review");
  const folder = values.output || path.join(root, "runs", refs.head);
  const key =
    process.env.PEEKAREVIEW_PROXY_TOKEN ||
    process.env.OPENROUTER_API_KEY ||
    readKey(
      await readFile(path.join(homedir(), ".env.openroutercopythis"), "utf8"),
    );
  const model = new ReviewerModel({
    key,
    model: values.model,
    cache: path.join(root, "responses"),
    budget,
    ...(process.env.PEEKAREVIEW_MODEL_URL
      ? { endpoint: process.env.PEEKAREVIEW_MODEL_URL }
      : {}),
  });
  const report = await review(snapshot, model, {
    log: console.log,
  });
  report.pr = refs.pr;
  report.targetBase = refs.targetBase;
  await mkdir(folder, { recursive: true });
  await writeFile(
    path.join(folder, "report.json"),
    JSON.stringify(report, null, 2),
  );
  await writeFile(path.join(folder, "review.md"), markdown(report));
  console.log(
    JSON.stringify(
      {
        report: path.join(folder, "review.md"),
        status: report.status,
        failure: report.failure || null,
        findings: report.findings.length,
        cost: report.cost,
        budget: await budget.status(),
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });

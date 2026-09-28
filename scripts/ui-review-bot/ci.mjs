import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import { normalizeAudit } from "./accessibility.mjs";
import { getModels, prNumber, validatePlan } from "./core.mjs";
import { decodeScreenshot, MAX_IMAGE_BYTES } from "./images.mjs";
import { captureRun, planRun, reviewRun, saveReport } from "./runner.mjs";

export async function readBounded(folder, name, limit) {
  const file = path.join(folder, name);
  const stat = await lstat(file);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size > limit ||
    path.dirname(await realpath(file)) !== (await realpath(folder))
  )
    throw new Error(`Invalid artifact file: ${name}`);
  return readFile(file);
}

export async function readManifest(folder) {
  const run = JSON.parse(await readBounded(folder, "plan.json", 200_000));
  if (
    run.prNumber !== prNumber(run.prNumber) ||
    run.pr?.number !== run.prNumber ||
    !/^[a-f0-9]{40}$/.test(run.revisions?.before) ||
    !/^[a-f0-9]{40}$/.test(run.revisions?.after)
  )
    throw new Error("Invalid plan identity.");
  run.plan = validatePlan(run.plan);
  return run;
}

function diagnostics(input, scenario, side) {
  if (
    !input ||
    !Array.isArray(input.errors) ||
    !Array.isArray(input.unhandled) ||
    !Array.isArray(input.actions)
  )
    throw new Error("Invalid capture diagnostics.");
  const strings = (values) =>
    (Array.isArray(values) ? values : [])
      .slice(0, 30)
      .map((v) => String(v).slice(0, 1000));
  const expected = scenario.actions.filter(
    (a) => side === "after" || a.only === "both",
  );
  const actions = expected.map((action, index) => ({
    ...action,
    ok:
      input.actions[index]?.ok === true &&
      input.actions[index]?.type === action.type &&
      input.actions[index]?.name === action.name,
  }));
  const errors = strings(input.errors);
  const unhandled = strings(input.unhandled);
  return {
    errors,
    unhandled,
    actions,
    blocked: strings(input.blocked),
    console: strings(input.console),
    text: String(input.text || "").slice(0, 9000),
    url: String(input.url || "").slice(0, 1000),
    preview: input.preview === true,
    accessibility: normalizeAudit(input.accessibility),
    ok:
      input.ok === true &&
      !errors.length &&
      !unhandled.length &&
      actions.every((a) => a.ok),
  };
}

// Capture artifacts came from a runner executing PR code. Never trust their paths,
// PR identity, model choice, Markdown, review text, or executable files.
export async function importCapture(run, input, output) {
  const captured = JSON.parse(
    await readBounded(input, "capture.json", 500_000),
  );
  if (
    !Array.isArray(captured.results) ||
    captured.results.length !== run.plan.scenarios.length
  )
    throw new Error("Capture does not match the trusted plan.");
  await mkdir(output, { recursive: true });
  run.results = [];
  for (const [index, scenario] of run.plan.scenarios.entries()) {
    const raw = captured.results[index];
    const item = {
      ...scenario,
      index,
      comparable:
        scenario.beforePath === scenario.afterPath &&
        scenario.actions.every((a) => a.only === "both"),
    };
    for (const side of ["before", "after"]) {
      const name = `${index}-${side}.png`;
      const png = decodeScreenshot(
        await readBounded(input, name, MAX_IMAGE_BYTES),
      );
      await writeFile(path.join(output, name), PNG.sync.write(png));
      item[side] = { ...diagnostics(raw[side], scenario, side), image: name };
    }
    if (scenario.focus) {
      const png = decodeScreenshot(
        await readBounded(input, `${index}-preview.png`, MAX_IMAGE_BYTES),
        { preview: true },
      );
      await writeFile(
        path.join(output, `${index}-preview.png`),
        PNG.sync.write(png),
      );
      if (!item.after.preview) item.after.ok = false;
    }
    item.diff = `${index}-diff.png`;
    item.status = item.before.ok && item.after.ok ? "captured" : "incomplete";
    // Recompute the percentage and diff from validated images rather than trusting metadata.
    const { compare } = await import("./runner.mjs");
    item.difference = await compare(
      path.join(output, `${index}-before.png`),
      path.join(output, `${index}-after.png`),
      path.join(output, `${index}-diff.png`),
    );
    run.results.push(item);
  }
  run.status = run.results.every((r) => r.status === "captured")
    ? "complete"
    : "partial";
}

async function main() {
  const [stage, first, second, third] = process.argv.slice(2);
  const signal = AbortSignal.timeout(20 * 60_000);
  const log = (phase, message) => console.log(`[${phase}] ${message}`);
  if (stage === "plan") {
    const token = process.env.OPENROUTER_API_KEY;
    if (!token)
      throw new Error("Set the OPENROUTER_API_KEY repository secret.");
    const model = process.env.UI_REVIEW_MODEL || "qwen/qwen3.8-flash";
    const selected = (await getModels()).find((m) => m.id === model);
    if (!selected)
      throw new Error("Select an available model with image input.");
    const reasoning = selected.reasoning?.supports_max_tokens
      ? { max_tokens: 512, exclude: true }
      : selected.reasoning?.supported_efforts?.includes("low")
        ? { effort: "low", exclude: true }
        : selected.reasoning && !selected.reasoning.mandatory
          ? { enabled: false }
          : undefined;
    const run = {
      id: randomUUID(),
      prNumber: prNumber(process.env.UI_REVIEW_PR),
      model,
      reasoning,
      mode: "ai",
      status: "running",
      startedAt: new Date().toISOString(),
      calls: 0,
      usage: { input: 0, output: 0, cost: 0, costKnown: true },
      events: [],
      results: [],
    };
    await planRun(run, token, signal, log);
    await mkdir(first, { recursive: true });
    await writeFile(
      path.join(first, "plan.json"),
      JSON.stringify(run, null, 2),
    );
  } else if (stage === "capture") {
    const run = await readManifest(first);
    await captureRun(run, signal, log, second);
    await writeFile(
      path.join(second, "capture.json"),
      JSON.stringify({ results: run.results }),
    );
    const incomplete = run.results.filter(
      (item) => !item.after?.ok || !item.before?.ok,
    );
    if (incomplete.length)
      throw new Error(
        `Capture incomplete: ${incomplete.map((item) => `${item.name}: ${[...(item.after?.errors || []), ...(item.before?.errors || []), ...(item.after?.unhandled || []), ...(item.before?.unhandled || []), ...(item.after?.actions || []).filter((action) => !action.ok).map((action) => `missing control ${action.name}`)].join(", ") || "page failed to render"}`).join("; ")}`,
      );
  } else if (stage === "review") {
    if (!process.env.OPENROUTER_API_KEY)
      throw new Error("Missing OpenRouter secret.");
    const run = await readManifest(first);
    await importCapture(run, second, third);
    await reviewRun(run, process.env.OPENROUTER_API_KEY, signal, log, third);
    run.finishedAt = new Date().toISOString();
    await saveReport(run, third);
  } else
    throw new Error(
      "Usage: ci.mjs plan OUTPUT | capture PLAN OUTPUT | review PLAN CAPTURE OUTPUT",
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });

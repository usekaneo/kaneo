import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readKey } from "../cli.mjs";
import { command, ROOT } from "../core.mjs";
import { Budget } from "./budget.mjs";
import { Snapshot } from "./context.mjs";
import { MODEL, ReviewerModel } from "./model.mjs";
import { ENGINE_VERSION, markdown, review } from "./review.mjs";

// Historical fixes are ground-truth candidates, never fed to the reviewer.
// Reversals are explicitly synthetic regression cases, not untouched real PRs.
export const cases = [
  [
    "dev",
    "d8cd08c533f62c55ac3d0faac0a0399cbfb70c2f",
    "apps/api/src/scheduler/due-date-reminders.ts",
    "Archived tasks receive due-date reminders",
  ],
  [
    "dev",
    "ab6d2b519762cb38f44e99bd1968acbafa4d4dec",
    "apps/web/src/lib/get-task-item-stats.ts",
    "Invalid closing fence exposes code-block checkboxes",
  ],
  [
    "dev",
    "442a38230291edb7784343dc8cf576705a32c737",
    "apps/api/src/label/controllers/get-label.ts",
    "Missing label query is not awaited; 404 branch cannot execute",
  ],
  [
    "dev",
    "a581bdd2a2cad087a88739732ea380b836d29bd6",
    "apps/api/src/project/index.ts",
    "Expired billing entitlement can create projects",
  ],
  [
    "dev",
    "6de9ea05f1ebdbfc4c91ab1ec0aed70cdc710ed8",
    "apps/api/src/plugins/generic-webhook/client.ts",
    "Redirect bypasses validated public webhook destination",
  ],
  [
    "dev",
    "902e3219e226827bfefe94955a435740473f2402",
    "apps/api/src/time-entry/controllers/create-time-entry.ts",
    "Completed time entry persists zero duration",
  ],
  [
    "dev",
    "6de9ea05f1ebdbfc4c91ab1ec0aed70cdc710ed8",
    "apps/api/src/task/controllers/update-task-assignee.ts",
    "Assignee can belong to another workspace",
  ],
  [
    "dev",
    "a945c21d38255944c301980c1297d054a1049bdb",
    "apps/web/src/hooks/queries/invitation/use-pending-invitations.ts",
    "Unauthorized pending invitations continue polling",
  ],
  [
    "holdout",
    "6de9ea05f1ebdbfc4c91ab1ec0aed70cdc710ed8",
    "apps/api/src/activity/index.ts",
    "Activity actor can be supplied by caller",
  ],
  [
    "holdout",
    "6de9ea05f1ebdbfc4c91ab1ec0aed70cdc710ed8",
    "apps/api/src/github-integration/index.ts",
    "Authenticated outsider can enumerate shared App repositories",
  ],
  [
    "holdout",
    "902e3219e226827bfefe94955a435740473f2402",
    "apps/api/src/scheduler/trial-reminders.ts",
    "Reminder failures never mark scheduler run degraded",
  ],
  [
    "holdout",
    "902e3219e226827bfefe94955a435740473f2402",
    "apps/api/src/index.ts",
    "PATCH bearer authentication skips API-key translation",
  ],
  [
    "holdout",
    "fd444930b6510f276ed5cb00ddb4ef091028d640",
    "apps/web/src/query-client/index.ts",
    "Unauthorized requests retry and fail to redirect",
  ],
  [
    "holdout",
    "2907fc3678a5ec02472826506c49ab2599acd6bf",
    "apps/api/src/custom-field/controllers/get-custom-field-values-by-task.ts",
    "Field ordering metadata is omitted from task field values",
  ],
  [
    "holdout",
    "6aa5f0cfac1bc499a7f42ea155eee3dbceeaf40f",
    "apps/web/src/hooks/mutations/custom-field/use-set-custom-field-value.ts",
    "Field-value mutation invalidates wrong cache key",
  ],
];

const directory = path.join(ROOT, ".cache/code-review/benchmark");

export async function prepare() {
  const folder = await mkdtemp(path.join(tmpdir(), "peekareq-benchmark-"));
  const output = [];
  try {
    for (const [i, [split, fix, file, expected]] of cases.entries()) {
      const env = {
        ...process.env,
        GIT_INDEX_FILE: path.join(folder, `index-${i}`),
        GIT_AUTHOR_NAME: "Peekareq benchmark",
        GIT_AUTHOR_EMAIL: "benchmark@example.invalid",
        GIT_COMMITTER_NAME: "Peekareq benchmark",
        GIT_COMMITTER_EMAIL: "benchmark@example.invalid",
        GIT_AUTHOR_DATE: "2026-09-17T00:00:00Z",
        GIT_COMMITTER_DATE: "2026-09-17T00:00:00Z",
      };
      const git = (args) => command("git", args, { env });
      await git(["read-tree", fix]);
      const original = await git(["rev-parse", `${fix}^:${file}`]);
      await git(["update-index", "--cacheinfo", `100644,${original},${file}`]);
      const tree = await git(["write-tree"]);
      const regression = await git([
        "-c",
        "commit.gpgsign=false",
        "commit-tree",
        tree,
        "-p",
        fix,
        "-m",
        "Benchmark change",
      ]);
      for (const kind of ["regression", "control"])
        output.push({
          id: `${String(i + 1).padStart(2, "0")}-${kind}`,
          split,
          kind,
          base: kind === "regression" ? fix : regression,
          head: kind === "regression" ? regression : fix,
          path: file,
          expected:
            kind === "regression"
              ? expected
              : "Fix direction: inspect unexpected findings individually; not assumed universally bug-free.",
          provenance: `https://github.com/usekaneo/kaneo/commit/${fix}`,
          synthetic: true,
        });
    }
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "cases.json"),
      JSON.stringify(output, null, 2),
    );
    return output;
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

async function main() {
  const [mode = "prepare", split = "dev", modelName = MODEL] =
    process.argv.slice(2);
  if (mode === "prepare") {
    console.log(
      `Prepared ${(await prepare()).length} paired historical cases.`,
    );
    return;
  }
  if (
    !["verified", "baseline"].includes(mode) ||
    !["dev", "holdout", "all"].includes(split)
  )
    throw new Error(
      "Usage: benchmark.mjs prepare | verified|baseline dev|holdout|all [model]",
    );
  const manifest = JSON.parse(
    await readFile(path.join(directory, "cases.json"), "utf8"),
  );
  const key = readKey(
    await readFile(path.join(homedir(), ".env.openroutercopythis"), "utf8"),
  );
  const budget = new Budget();
  const summaries = [];
  const selected = manifest.filter((c) => split === "all" || c.split === split);
  let writeChain = Promise.resolve();
  const runCase = async (item) => {
    const folder = path.join(
      directory,
      `${modelName.replaceAll("/", "_")}-v${ENGINE_VERSION}`,
      mode,
      item.id,
    );
    let report;
    try {
      report = JSON.parse(
        await readFile(path.join(folder, "report.json"), "utf8"),
      );
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    if (!report) {
      const model = new ReviewerModel({
        key,
        model: modelName,
        cache: path.join(ROOT, ".cache/code-review/responses"),
        budget,
      });
      console.log(`Reviewing ${item.id} (${split}, ${mode})`);
      try {
        report = await review(new Snapshot(ROOT, item.base, item.head), model, {
          baseline: mode === "baseline",
          probes: true,
          log: console.log,
        });
      } catch (e) {
        if (/Budget|ledger|pricing/.test(e.message)) throw e;
        report = {
          version: ENGINE_VERSION,
          status: "inconclusive",
          head: item.head,
          base: item.base,
          findings: [],
          rejected: [],
          error: e.message,
          calls: model.calls,
          cost: model.calls.reduce((sum, c) => sum + (c.billedNow || 0), 0),
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          coverage: {
            omitted: [item.path],
            limitations: [`Review failed: ${e.message}`],
          },
        };
      }
      await mkdir(folder, { recursive: true });
      await writeFile(
        path.join(folder, "report.json"),
        JSON.stringify(report, null, 2),
      );
      await writeFile(path.join(folder, "review.md"), markdown(report));
    }
    summaries.push({
      ...item,
      status: report.status,
      error: report.error,
      findings: report.findings,
      rejected: report.rejected,
      cost: report.cost,
      adjudication: null,
      note: "Match root cause manually; a matching file alone is not a true positive.",
    });
    writeChain = writeChain.then(() =>
      writeFile(
        path.join(
          directory,
          `${modelName.replaceAll("/", "_")}-v${ENGINE_VERSION}-${mode}-${split}.json`,
        ),
        JSON.stringify(summaries, null, 2),
      ),
    );
    await writeChain;
    console.log(
      `${item.id}: ${report.findings.length} findings; cumulative ledger ${JSON.stringify(await budget.status())}`,
    );
  };
  let stopped = false;
  const work = async () => {
    while (selected.length && !stopped) {
      const item = selected.shift();
      try {
        await runCase(item);
      } catch (e) {
        stopped = true;
        throw e;
      }
    }
  };
  const outcomes = await Promise.allSettled([work(), work()]);
  for (const result of outcomes)
    if (result.status === "rejected") throw result.reason;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });

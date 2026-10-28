import { appendFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { areRuntimeNeutralFiles } from "./runtime-neutral-changes.mjs";

const API = "https://api.github.com";
const WORKFLOW = ".github/workflows/browserstack.yml";
const MAX_AGE = 86_400_000;
const MAX_RUNS = 20;
const MAX_JOB_READS = 5;
const DEADLINE = 10_000;
const SHA = /^[0-9a-f]{40}$/i;
const neutral = (reason = "insufficient-evidence") => ({ skip: false, reason });
const shaValid = (value) => typeof value === "string" && SHA.test(value);
const positive = (value) =>
  (typeof value === "number" ||
    (typeof value === "string" && /^[1-9][0-9]*$/.test(value))) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0;

async function body(response) {
  if (!response || response.status !== 200 || response.redirected)
    throw new Error("unavailable");
  return response.json();
}
function runValid(run, repo) {
  return (
    run &&
    positive(run.id) &&
    positive(run.run_attempt) &&
    shaValid(run.head_sha) &&
    run.head_branch === "main" &&
    [WORKFLOW, `${WORKFLOW}@refs/heads/main`].includes(run.path) &&
    ["push", "workflow_dispatch", "schedule"].includes(run.event) &&
    run.status === "completed" &&
    run.conclusion === "success" &&
    run.repository?.full_name === repo &&
    run.head_repository?.full_name === repo
  );
}
function jobValid(job, run) {
  return (
    job &&
    positive(job.id) &&
    job.run_id === run.id &&
    job.run_attempt === run.run_attempt &&
    job.head_sha === run.head_sha &&
    job.name === "smoke" &&
    job.status === "completed" &&
    job.conclusion === "success" &&
    Array.isArray(job.steps)
  );
}
function fullCompletion(job) {
  const steps = job.steps.filter(
    (step) => step?.name === "Run browser smoke tests",
  );
  if (
    steps.length !== 1 ||
    steps[0].status !== "completed" ||
    steps[0].conclusion !== "success"
  )
    return null;
  const time = Date.parse(steps[0].completed_at);
  return Number.isFinite(time) ? time : null;
}
function cheapCompletion(job) {
  const classify = job.steps.filter(
    (step) => step?.name === "Classify BrowserStack changes",
  );
  const test = job.steps.filter(
    (step) => step?.name === "Run browser smoke tests",
  );
  return (
    classify.length === 1 &&
    classify[0].status === "completed" &&
    classify[0].conclusion === "success" &&
    test.length === 1 &&
    test[0].status === "completed" &&
    test[0].conclusion === "skipped"
  );
}
function pushValid(input) {
  return (
    input.eventName === "push" &&
    input.ref === "refs/heads/main" &&
    shaValid(input.sha) &&
    positive(input.runId) &&
    positive(input.runAttempt) &&
    Number(input.runAttempt) === 1 &&
    input.event?.after === input.sha &&
    input.event.ref === input.ref &&
    input.event.forced === false &&
    input.event.deleted === false &&
    input.event.repository?.full_name === input.repository &&
    typeof input.repository === "string" &&
    /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(input.repository)
  );
}
function changes(compare, baseline, head) {
  if (
    !compare ||
    compare.truncated === true ||
    compare.incomplete_results === true ||
    compare.status !== "ahead" ||
    !Number.isSafeInteger(compare.ahead_by) ||
    compare.ahead_by < 1 ||
    compare.behind_by !== 0 ||
    !Number.isSafeInteger(compare.total_commits) ||
    compare.total_commits < 1 ||
    compare.total_commits > 250 ||
    compare.ahead_by !== compare.total_commits ||
    !Array.isArray(compare.commits) ||
    compare.commits.length !== compare.total_commits ||
    compare.base_commit?.sha !== baseline ||
    compare.merge_base_commit?.sha !== baseline ||
    compare.commits.at(-1)?.sha !== head ||
    !Array.isArray(compare.files) ||
    compare.files.length === 0 ||
    compare.files.length >= 300
  )
    return null;
  for (const file of compare.files) {
    if (
      !file ||
      typeof file.filename !== "string" ||
      !file.filename ||
      !["added", "modified", "removed", "renamed"].includes(file.status)
    )
      return null;
    if (
      file.previous_filename !== undefined &&
      (typeof file.previous_filename !== "string" || !file.previous_filename)
    )
      return null;
    if (file.status === "renamed" && typeof file.previous_filename !== "string")
      return null;
  }
  return compare.files;
}

async function classify(input) {
  if (!input || !pushValid(input)) return neutral("non-qualifying-context");
  if (
    typeof input.request !== "function" ||
    typeof input.token !== "string" ||
    !input.token ||
    !Number.isFinite(input.now)
  )
    return neutral();
  const deadline = Date.now() + DEADLINE;
  let requests = 0;
  const root = `/repos/${input.repository}`;
  const get = async (path) => {
    if (++requests > MAX_JOB_READS + 2 || Date.now() >= deadline)
      throw new Error("budget");
    const url = `${API}${path}`;
    if (new URL(url).origin !== API || !path.startsWith(`${root}/`))
      throw new Error("route");
    return body(
      await input.request(url, {
        headers: {
          authorization: `Bearer ${input.token}`,
          accept: "application/vnd.github+json",
          "x-github-api-version": "2022-11-28",
        },
        redirect: "error",
        signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
      }),
    );
  };
  try {
    const history = await get(
      `${root}/actions/workflows/browserstack.yml/runs?branch=main&per_page=${MAX_RUNS}`,
    );
    if (
      !Array.isArray(history.workflow_runs) ||
      history.workflow_runs.length === 0 ||
      history.workflow_runs.length > MAX_RUNS ||
      !Number.isSafeInteger(history.total_count) ||
      history.total_count < history.workflow_runs.length
    )
      return neutral("history-incomplete");
    const records = history.workflow_runs.filter(
      (run) => run?.id !== Number(input.runId),
    );
    if (
      records.length !==
      history.workflow_runs.length -
        (history.workflow_runs.some((run) => run?.id === Number(input.runId))
          ? 1
          : 0)
    )
      return neutral("history-malformed");
    let baseline = null;
    let jobsRead = 0;
    for (const run of records) {
      if (!runValid(run, input.repository))
        return neutral("uncertain-recent-run");
      if (++jobsRead > MAX_JOB_READS) return neutral("history-bound");
      const result = await get(
        `${root}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`,
      );
      if (
        !Array.isArray(result.jobs) ||
        result.total_count !== 1 ||
        result.jobs.length !== 1
      )
        return neutral("jobs-incomplete");
      const job = result.jobs[0];
      if (!jobValid(job, run)) return neutral("job-mismatch");
      const finished = fullCompletion(job);
      if (finished !== null) {
        if (finished > input.now || input.now - finished >= MAX_AGE)
          return neutral("stale-baseline");
        baseline = run;
        break;
      }
      if (!cheapCompletion(job)) return neutral("missing-full-proof");
    }
    if (!baseline) return neutral("baseline-unavailable");
    const comparison = await get(
      `${root}/compare/${baseline.head_sha}...${input.sha}`,
    );
    const files = changes(comparison, baseline.head_sha, input.sha);
    if (!files || !areRuntimeNeutralFiles(files))
      return neutral("changes-require-full-validation");
    return {
      skip: true,
      reason: "validated-neutral-changes",
      baselineSha: baseline.head_sha,
    };
  } catch {
    return neutral("api-or-budget-error");
  }
}

export async function classifyBrowserStack(input) {
  try {
    return await classify(input);
  } catch {
    return neutral("invalid-input");
  }
}

async function main() {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) throw new Error("GITHUB_OUTPUT is required");
  let skip = false;
  try {
    const event = JSON.parse(
      await readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
    );
    const result = await classifyBrowserStack({
      eventName: process.env.GITHUB_EVENT_NAME,
      ref: process.env.GITHUB_REF,
      sha: process.env.GITHUB_SHA,
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      event,
      repository: process.env.GITHUB_REPOSITORY,
      token: process.env.GITHUB_TOKEN,
      now: Date.now(),
      request: globalThis.fetch,
    });
    skip = result.skip === true;
    console.log(
      `BrowserStack classification: ${skip ? "proven-neutral" : `full-validation (${result.reason})`}`,
    );
  } catch {
    console.log("BrowserStack classification: full-validation (invalid-event)");
  }
  await appendFile(output, `skip_browserstack=${skip}\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main().catch(() => {
    console.error("BrowserStack classification failed");
    process.exitCode = 1;
  });

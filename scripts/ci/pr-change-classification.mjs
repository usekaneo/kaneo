import { readFile } from "node:fs/promises";
import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { areRuntimeNeutralFiles } from "./runtime-neutral-changes.mjs";

const expensive = ["integration", "storage", "docker-build", "split-images"];

export function classifyChanges({ eventName, files, complete, error = false }) {
  const full = { skipExpensive: false };
  if (
    eventName !== "pull_request" ||
    error ||
    !complete ||
    !Array.isArray(files) ||
    files.length === 0
  )
    return full;
  return areRuntimeNeutralFiles(files) ? { skipExpensive: true } : full;
}

export function assessGate({ eventName, skipExpensive, jobs }) {
  if (!jobs || typeof jobs !== "object") return "failure";
  const allowedSkipped = new Set(
    skipExpensive && eventName === "pull_request"
      ? [...expensive, "smoke"]
      : [],
  );
  if (
    ["push", "workflow_dispatch", "workflow_call", "schedule"].includes(
      eventName,
    )
  )
    allowedSkipped.add("smoke");
  for (const [name, status] of Object.entries(jobs)) {
    if (
      name === "secret-scan" &&
      eventName === "schedule" &&
      status === "skipped"
    )
      continue;
    if (allowedSkipped.has(name) && status === "skipped") continue;
    if (status !== "success") return "failure";
  }
  const required = [
    "detect-pr-changes",
    "smoke",
    "peekareq-tests",
    "slop-labeler-tests",
    "quality",
    "unit",
    "build",
    "integration",
    "docker-build",
    "workflows",
    "storage",
    "split-images",
    "secret-scan",
  ];
  if (required.some((name) => !(name in jobs))) return "failure";
  return "success";
}

export async function getPrFiles({
  token,
  repository,
  pullNumber,
  expectedBase,
  expectedHead,
}) {
  const headers = {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  };
  const request = (url) =>
    fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  const root = `https://api.github.com/repos/${repository}`;
  const pullResponse = await request(`${root}/pulls/${pullNumber}`);
  if (!pullResponse.ok)
    throw new Error(`PR metadata API returned ${pullResponse.status}`);
  const pull = await pullResponse.json();
  if (
    pull.base?.sha !== expectedBase ||
    pull.head?.sha !== expectedHead ||
    !Number.isInteger(pull.changed_files) ||
    pull.changed_files > 3000
  )
    throw new Error("PR revision mismatch or file count exceeds API limit");
  const files = [];
  for (let page = 1; page <= 30; page += 1) {
    const response = await request(
      `${root}/pulls/${pullNumber}/files?per_page=100&page=${page}`,
    );
    if (!response.ok)
      throw new Error(`PR files API returned ${response.status}`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error("Malformed PR files response");
    files.push(...batch);
    if (batch.length < 100) break;
  }
  if (files.length !== pull.changed_files)
    throw new Error("Incomplete PR file list");
  const verify = await request(`${root}/pulls/${pullNumber}`);
  if (!verify.ok) throw new Error("Could not revalidate PR revision");
  const latest = await verify.json();
  if (
    latest.base?.sha !== expectedBase ||
    latest.head?.sha !== expectedHead ||
    latest.changed_files !== pull.changed_files
  )
    throw new Error("PR changed while files were fetched");
  return files;
}

async function main() {
  if (process.env.CI_GATE_JOBS) {
    const jobs = JSON.parse(process.env.CI_GATE_JOBS);
    const result = assessGate({
      eventName: process.env.GITHUB_EVENT_NAME,
      skipExpensive: process.env.CI_SKIP_EXPENSIVE === "true",
      jobs,
    });
    console.log(`CI result gate: ${result}`);
    if (result !== "success") process.exitCode = 1;
    return;
  }
  const event = JSON.parse(
    await readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
  );
  let files = null;
  let error = false;
  if (process.env.GITHUB_EVENT_NAME === "pull_request") {
    try {
      files = await getPrFiles({
        token: process.env.GITHUB_TOKEN,
        repository: process.env.GITHUB_REPOSITORY,
        pullNumber: event.number,
        expectedBase: event.pull_request.base.sha,
        expectedHead: event.pull_request.head.sha,
      });
    } catch (cause) {
      error = true;
      console.error(`Change detection failed closed: ${cause.message}`);
    }
  }
  const result = classifyChanges({
    eventName: process.env.GITHUB_EVENT_NAME,
    files,
    complete: !error,
    error,
  });
  console.log(`skip_expensive=${result.skipExpensive}`);
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `skip_expensive=${result.skipExpensive}\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href &&
  process.env.GITHUB_EVENT_PATH
)
  await main();

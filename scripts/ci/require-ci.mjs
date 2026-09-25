// biome-ignore-all lint/suspicious/noUndeclaredEnvVars: Standalone GitHub Actions release guard.
import { execFileSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";

export function assessRuns(runs, sha) {
  const latest = runs
    .filter(
      (run) =>
        run.head_sha === sha &&
        run.head_branch === "main" &&
        ["push", "workflow_dispatch"].includes(run.event),
    )
    .sort(
      (a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt,
    )[0];
  if (latest?.status !== "completed") return "pending";
  return latest.conclusion === "success" ? "success" : "failure";
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const sha = process.env.GITHUB_SHA;
  if (
    !/^[\w.-]+\/[\w.-]+$/.test(repo ?? "") ||
    !/^[a-f0-9]{40}$/.test(sha ?? "")
  ) {
    throw new Error("Expected GitHub repository and full release source SHA");
  }
  const deadline = Date.now() + 30 * 60_000;
  while (Date.now() < deadline) {
    const result = JSON.parse(
      execFileSync(
        "gh",
        [
          "api",
          `repos/${repo}/actions/workflows/ci.yml/runs?head_sha=${sha}&branch=main&per_page=100`,
        ],
        { encoding: "utf8", timeout: 30_000 },
      ),
    );
    const state = assessRuns(result.workflow_runs, sha);
    if (state === "success") {
      console.log(`CI passed for release source ${sha}`);
      return;
    }
    if (state === "failure")
      throw new Error(
        `Latest main CI run failed for ${sha}; fix or rerun CI before releasing`,
      );
    console.log(`Waiting for main CI on ${sha}`);
    await setTimeout(20_000);
  }
  throw new Error(
    "Timed out waiting for successful CI; missing, skipped, or pending checks cannot authorize a release",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();

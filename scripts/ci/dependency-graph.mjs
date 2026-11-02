import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { buildSnapshot, lockPaths } from "./dependency-graph-snapshot.mjs";

export async function main(args = process.argv.slice(2), env = process.env) {
  if (args.length !== 1 || !["--dry-run", "--submit"].includes(args[0])) {
    throw new Error(
      "Usage: node scripts/ci/dependency-graph.mjs --dry-run|--submit",
    );
  }
  const sources = Object.fromEntries(
    await Promise.all(
      lockPaths.map(async (path) => [path, await readFile(path, "utf8")]),
    ),
  );
  const snapshot = buildSnapshot(sources, {
    sha: env.GITHUB_SHA,
    ref: env.GITHUB_REF,
    runId: `${env.GITHUB_RUN_ID || "dry-run"}-${env.GITHUB_RUN_ATTEMPT || "1"}`,
    scanned: new Date().toISOString(),
  });
  if (args[0] === "--dry-run") {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    return;
  }

  if (
    env.GITHUB_ACTIONS !== "true" ||
    !["push", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME)
  ) {
    throw new Error("Submission requires a trusted main workflow");
  }
  if (!env.GITHUB_TOKEN || !/^\d+$/.test(env.GITHUB_RUN_ID ?? "")) {
    throw new Error("Missing workflow credentials");
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY ?? "")) {
    throw new Error("Invalid repository");
  }

  const endpoint = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/dependency-graph/snapshots`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2026-03-10",
    },
    body: JSON.stringify(snapshot),
    redirect: "error",
    signal: AbortSignal.timeout(60_000),
  });
  if (response.status !== 201) {
    throw new Error(`Dependency submission failed: HTTP ${response.status}`);
  }
  const result = await response.json();
  if (result.result !== "SUCCESS")
    throw new Error("Dependency submission did not report SUCCESS");
  for (const [path, manifest] of Object.entries(snapshot.manifests)) {
    const count = Object.keys(manifest.resolved).length;
    console.log(`${path}: submitted ${count} npm packages`);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

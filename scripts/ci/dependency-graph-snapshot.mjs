import { buildManifest } from "./dependency-graph-lock.mjs";

export const lockPaths = ["pnpm-lock.yaml", "tests/e2e/pnpm-lock.yaml"];

// https://docs.github.com/en/rest/dependency-graph/dependency-submission
export function buildSnapshot(sources, { sha, ref, runId, scanned }) {
  if (!/^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(sha ?? "")) {
    throw new Error("Invalid commit SHA");
  }
  if (ref !== "refs/heads/main")
    throw new Error("Dependency snapshots require main");
  if (typeof runId !== "string" || !runId) throw new Error("Missing run ID");
  if (typeof scanned !== "string" || !Number.isFinite(Date.parse(scanned))) {
    throw new Error("Invalid scan time");
  }
  if (
    Object.keys(sources).sort().join("\n") !== [...lockPaths].sort().join("\n")
  ) {
    throw new Error("Both application and e2e locks are required");
  }
  return {
    version: 0,
    sha,
    ref,
    job: { id: runId, correlator: "kaneo-pnpm-locks" },
    detector: {
      name: "kaneo-pnpm-locks",
      version: "1.0.0",
      url: "https://github.com/usekaneo/kaneo/blob/main/scripts/ci/dependency-graph.mjs",
    },
    scanned,
    manifests: Object.fromEntries(
      lockPaths.map((path) => [path, buildManifest(sources[path], path)]),
    ),
  };
}

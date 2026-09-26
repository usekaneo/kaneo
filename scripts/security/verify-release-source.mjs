// biome-ignore-all lint/suspicious/noUndeclaredEnvVars: GitHub Actions invokes this guard directly, outside Turbo's cache.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

// Run from the workflow's main-branch checkout BEFORE checking out a release
// tag. Never execute verification code taken from an unverified tag.
const [mode, version = ""] = process.argv.slice(2);
const git = (...args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const source = process.env.GITHUB_SHA;
if (
  process.env.GITHUB_REF !== "refs/heads/main" ||
  !/^[0-9a-f]{40}$/.test(source ?? "")
) {
  throw new Error(
    "Publication must use a main-branch workflow with a full source SHA",
  );
}
if (git("rev-parse", "HEAD") !== source)
  throw new Error("Checkout does not match the workflow source");
git("merge-base", "--is-ancestor", source, "refs/remotes/origin/main");

let approved = source;
if (mode === "nightly") {
  if (version !== "")
    throw new Error("Nightly builds cannot claim a release version");
} else if (mode === "planned" || mode === "released") {
  execFileSync(
    process.execPath,
    ["scripts/security/validate-release-version.mjs", version, "--new-version"],
    { stdio: "inherit" },
  );
  const tag = `refs/tags/v${version}`;
  if (mode === "planned") {
    if (git("rev-parse", "refs/remotes/origin/main") !== source) {
      throw new Error(
        "Main advanced since release planning; start a new release run",
      );
    }
    let exists = false;
    try {
      git("rev-parse", "--verify", tag);
      exists = true;
    } catch {}
    if (exists) throw new Error("The planned release tag already exists");
  } else {
    approved = git("rev-parse", "--verify", `${tag}^{commit}`);
    git("merge-base", "--is-ancestor", approved, "refs/remotes/origin/main");
    const pkg = JSON.parse(git("show", `${approved}:package.json`));
    const chart = git("show", `${approved}:charts/kaneo/Chart.yaml`);
    const field = (name) =>
      chart.match(
        new RegExp(`^${name}:\\s*["']?([^\\s"']+)["']?\\s*$`, "m"),
      )?.[1];
    if (
      pkg.version !== version ||
      field("version") !== version ||
      field("appVersion") !== version
    ) {
      throw new Error(
        "Release tag, package version and Helm chart versions must agree",
      );
    }
  }
} else {
  throw new Error("Unknown publication source mode");
}

if (process.env.GITHUB_OUTPUT)
  appendFileSync(process.env.GITHUB_OUTPUT, `source_sha=${approved}\n`);
console.log(`Verified ${mode} publication source: ${approved}`);

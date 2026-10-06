import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const browserWorkflow = readFileSync(
  `${repoRoot}/.github/workflows/browser-tests.yml`,
  "utf8",
);
const ciWorkflow = readFileSync(`${repoRoot}/.github/workflows/ci.yml`, "utf8");

// Slice a workflow at a job's body, stopping at the next sibling job so
// later jobs (e.g. ci.yml's split-images, which reuses some of the same
// actions with a different cache-key) cannot leak into the comparison.
function jobSection(workflow, jobName) {
  const header = `  ${jobName}:`;
  const start = workflow.indexOf(header);
  if (start === -1) return null;
  const tail = workflow.slice(start + header.length);
  const end = tail.search(/^  [a-z][\w-]*:/m);
  return end === -1 ? tail : tail.slice(0, end);
}

// The action identifier is the `name@sha` part of a `uses:` line; the
// trailing `# vX.Y.Z` comment is a human aid, not a behavioral contract.
function actionRef(line) {
  const match = line.match(/uses:\s*(\S+)/);
  if (!match) return null;
  return match[1].split("#")[0].trim();
}

function firstInput(section, key) {
  const re = new RegExp(`^\\s+${key}:\\s*(.+)$`, "m");
  const match = section.match(re);
  return match ? match[1].trim() : null;
}

const dockerBuild = jobSection(ciWorkflow, "docker-build");
const smoke = jobSection(browserWorkflow, "smoke");
assert.ok(dockerBuild, "ci.yml must contain a docker-build job");
assert.ok(smoke, "browser-tests.yml must contain a smoke job");

const ciBuilder = dockerBuild
  .split("\n")
  .filter((line) => /useblacksmith\/setup-docker-builder@/.test(line))
  .map(actionRef)[0];
const ciBuildAction = dockerBuild
  .split("\n")
  .filter((line) => /useblacksmith\/build-push-action@/.test(line))
  .map(actionRef)[0];
const ciCheckout = dockerBuild
  .split("\n")
  .filter((line) => /useblacksmith\/checkout@/.test(line))
  .map(actionRef)[0];
const ciCacheKey = firstInput(dockerBuild, "cache-key");
const ciRunsOn = firstInput(dockerBuild, "runs-on");
assert.ok(
  ciBuilder,
  "ci.yml docker-build must pin useblacksmith/setup-docker-builder",
);
assert.ok(
  ciBuildAction,
  "ci.yml docker-build must pin useblacksmith/build-push-action",
);
assert.ok(ciCheckout, "ci.yml docker-build must pin useblacksmith/checkout");
assert.ok(ciCacheKey, "ci.yml docker-build must declare a cache-key");
assert.ok(ciRunsOn, "ci.yml docker-build must declare a runs-on");

const smokeBuilder = smoke
  .split("\n")
  .filter((line) => /useblacksmith\/setup-docker-builder@/.test(line))
  .map(actionRef)[0];
const smokeBuildAction = smoke
  .split("\n")
  .filter((line) => /useblacksmith\/build-push-action@/.test(line))
  .map(actionRef)[0];
const smokeCheckout = smoke
  .split("\n")
  .filter((line) => /checkout@/.test(line))
  .map(actionRef)[0];
const smokeCacheKey = firstInput(smoke, "cache-key");
const smokeRunsOn = firstInput(smoke, "runs-on");

test("browser smoke runs on the same Blacksmith runner as CI docker-build", () => {
  // The shared builder/cache contract only works while both jobs run on
  // Blacksmith's remote-builder runtime. A non-Blacksmith runner leaves
  // the shared cache namespace unreachable from this workflow.
  assert.equal(
    smokeRunsOn,
    ciRunsOn,
    `smoke job runs-on must match ci.yml docker-build runs-on (${ciRunsOn})`,
  );
});

test("browser smoke build pins the same Blacksmith setup-docker-builder as CI docker-build", () => {
  // A different builder setup action means the smoke job no longer
  // participates in the shared builder contract, even with a matching
  // cache-key.
  assert.equal(smokeBuilder, ciBuilder, `smoke job must pin ${ciBuilder}`);
  assert.ok(
    !/docker\/setup-buildx-action@/.test(smoke),
    "smoke job must not fall back to docker/setup-buildx-action",
  );
});

test("browser smoke build pins the same Blacksmith build-push-action as CI docker-build", () => {
  // The build action identity is the source-of-truth pin. platforms, push,
  // and load are workflow inputs read by this action, not behaviors it
  // enforces.
  assert.equal(
    smokeBuildAction,
    ciBuildAction,
    `smoke job must pin ${ciBuildAction}`,
  );
  assert.ok(
    !/docker\/build-push-action@/.test(smoke),
    "smoke job must not fall back to docker/build-push-action",
  );
});

test("browser smoke build shares the CI docker-build cache-key and drops the GHA cache inputs", () => {
  // The cache-key determines the Blacksmith cache namespace. Matching the
  // CI docker-build key is necessary for the two jobs to share warmed
  // layers; sharing the key does not, on its own, guarantee every run
  // is warm.
  assert.equal(
    smokeCacheKey,
    ciCacheKey,
    `smoke job must declare cache-key: ${ciCacheKey}`,
  );
  assert.ok(
    !/^\s*cache-from:/m.test(smoke),
    "smoke job must not declare cache-from (Blacksmith cache replaces GHA cache)",
  );
  assert.ok(
    !/^\s*cache-to:/m.test(smoke),
    "smoke job must not declare cache-to (Blacksmith cache replaces GHA cache)",
  );
});

test("browser smoke build keeps the same explicit platforms/push/load and overrides only the image tag", () => {
  // platforms, push, and load are workflow inputs the build action reads;
  // they are not enforced by the action pin. The smoke job must keep
  // them so the same single-platform load behavior holds. The image tag
  // is the one knob the smoke job changes to avoid colliding with
  // kaneo:ci in the local daemon.
  assert.match(
    smoke,
    /^\s+platforms:\s*linux\/amd64/m,
    "smoke job must pin platforms: linux/amd64",
  );
  assert.match(
    smoke,
    /^\s+push:\s*false\b/m,
    "smoke job must declare push: false",
  );
  assert.match(
    smoke,
    /^\s+load:\s*true\b/m,
    "smoke job must declare load: true",
  );
  assert.match(
    smoke,
    /^\s+tags:\s*kaneo-browserstack:test\b/m,
    "smoke job must keep the kaneo-browserstack:test tag used by tests/e2e/compose.yml",
  );
  assert.ok(
    !/^\s+tags:\s*kaneo:ci\b/m.test(smoke),
    "smoke job must not reuse the CI kaneo:ci tag",
  );
});

test("browser smoke checkout uses the Blacksmith action and persist-credentials:false", () => {
  // persist-credentials:false prevents the checkout action from leaving
  // its credentials available to subsequent steps. It does not, on its
  // own, stop the runner from inheriting GITHUB_TOKEN or prove the
  // workflow is secret-safe.
  assert.ok(smokeCheckout, "smoke job must declare a checkout step");
  assert.equal(
    smokeCheckout,
    ciCheckout,
    `smoke job must pin the same useblacksmith/checkout action as CI (${ciCheckout})`,
  );
  const checkoutLine = smoke.split("\n").find((line) => /checkout@/.test(line));
  const checkoutStart = smoke.indexOf(checkoutLine);
  const nextStep = smoke.indexOf(
    "\n      -",
    checkoutStart + checkoutLine.length,
  );
  const checkoutBlock = smoke.slice(
    checkoutStart,
    nextStep === -1 ? smoke.length : nextStep,
  );
  assert.match(
    checkoutBlock,
    /^\s+persist-credentials:\s*false/m,
    "checkout step must set persist-credentials: false",
  );
});

#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { appSpec, assertDeployment, configuration } from "./config.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const command = process.argv[2];
assert.ok(
  ["deploy", "validate"].includes(command),
  "Usage: node scripts/deploy/digitalocean.mjs deploy|validate",
);
const temporary = mkdtempSync(path.join(tmpdir(), "kaneo-deploy-"));
let stage = "configuration";
rmSync(path.join(root, ".cache/deploy/result.json"), { force: true });

function run(binary, args, input) {
  try {
    return execFileSync(binary, args, {
      input,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 90 * 60 * 1000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    // CLI errors may echo secure parameters or entire application specs.
    throw new Error(
      `${binary} ${args.slice(0, 2).join(" ")} failed during ${stage}; inspect the provider console (no secrets are logged here)`,
    );
  }
}
const doctl = (...args) =>
  JSON.parse(run("doctl", [...args, "--output", "json"]));
const one = (value) => (Array.isArray(value) ? value[0] : value);
const az = (...args) =>
  JSON.parse(run("az", [...args, "--only-show-errors", "--output", "json"]));
function privateFile(name, value) {
  const file = path.join(temporary, name);
  writeFileSync(file, JSON.stringify(value), { mode: 0o600 });
  return file;
}

async function waitFor(description, read, ready, timeoutMs = 30 * 60 * 1000) {
  const deadline = Date.now() + timeoutMs;
  console.log(`Waiting for ${description}`);
  while (Date.now() < deadline) {
    const value = read();
    if (ready(value)) return value;
    await delay(10000);
  }
  throw new Error(
    `Timed out waiting for ${description}; rerun validate or inspect the same deployment in the provider console`,
  );
}

async function waitForDeployment(appId, deploymentId) {
  return waitFor(
    `deployment ${deploymentId}`,
    () => one(doctl("apps", "get-deployment", appId, deploymentId)),
    (deployment) => {
      assert.ok(
        !["ERROR", "CANCELED", "SUPERSEDED"].includes(deployment.phase),
        `Deployment ${deploymentId}: ${deployment.phase}`,
      );
      return deployment.phase === "ACTIVE";
    },
  );
}

async function verify(appId, deploymentId, digest) {
  const deployment = await waitForDeployment(appId, deploymentId);
  assertDeployment(deployment, digest);
  let app = one(doctl("apps", "get", appId));
  assert.equal(
    app.active_deployment?.id,
    deploymentId,
    "A different deployment is live",
  );
  const primaryDomain = deployment.spec.domains?.find(
    (domain) => domain.type === "PRIMARY",
  )?.domain;
  const url = primaryDomain ? `https://${primaryDomain}` : app.live_url;
  assert.equal(new URL(url).protocol, "https:");
  stage = "public HTTP validation";
  for (const [route, validate] of [
    [
      "/api/health",
      async (response) =>
        assert.deepEqual(await response.json(), { status: "ok" }),
    ],
    [
      "/",
      async (response) => {
        assert.match(response.headers.get("content-type"), /text\/html/);
        const html = await response.text();
        const script = html.match(/<script[^>]+src="([^"]+\.js)"/);
        assert.ok(script, "Web app JavaScript missing");
        const assetUrl = new URL(script[1], url);
        assert.equal(assetUrl.origin, new URL(url).origin);
        const asset = await fetch(assetUrl, {
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        });
        assert.equal(asset.status, 200);
        assert.match(asset.headers.get("content-type"), /javascript/);
        assert.ok(
          !(await asset.text()).includes("KANEO_API_URL"),
          "Unconfigured web API URL",
        );
      },
    ],
    [
      "/api/auth/get-session",
      async (response) => assert.equal(await response.json(), null),
    ],
  ]) {
    const response = await fetch(new URL(route, url), {
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    assert.equal(response.status, 200, `${route} failed`);
    await validate(response);
  }
  app = one(doctl("apps", "get", appId));
  assert.equal(
    app.active_deployment?.id,
    deploymentId,
    "Deployment changed while validating",
  );
  const result = {
    appId,
    deploymentId,
    imageDigest: digest,
    url,
    checkedAt: new Date().toISOString(),
    checks: [
      "deployment",
      "postgres-migrations",
      "redis-pubsub",
      "object-storage",
      "web-assets",
      "api",
      "auth",
    ],
  };
  const directory = path.join(root, ".cache/deploy");
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, "result.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(`Deployment passed: ${url} (${deploymentId})`);
}

try {
  if (command === "validate") {
    assert.ok(
      process.env.DO_APP_ID &&
        process.env.DO_DEPLOYMENT_ID &&
        process.env.KANEO_IMAGE_DIGEST,
      "validate requires DO_APP_ID, DO_DEPLOYMENT_ID and KANEO_IMAGE_DIGEST from the requested deployment",
    );
    await verify(
      process.env.DO_APP_ID,
      process.env.DO_DEPLOYMENT_ID,
      process.env.KANEO_IMAGE_DIGEST,
    );
  } else {
    const config = configuration(process.env);
    stage = "Azure account check";
    const account = az(
      "account",
      "show",
      "--subscription",
      config.subscription,
    );
    assert.equal(
      account.id,
      config.subscription,
      "Unexpected Azure subscription",
    );
    const apps = doctl("apps", "list").filter(
      (app) => app.spec.name === config.name,
    );
    assert.ok(
      apps.length <= 1,
      "Multiple matching apps; use a unique DO_APP_NAME",
    );
    let app = apps[0];
    if (!app) {
      stage = "App Platform bootstrap";
      app = one(
        doctl(
          "apps",
          "create",
          "--spec",
          privateFile("bootstrap.json", appSpec(config)),
        ),
      );
      console.log(`Created app ${app.id}`);
    }
    assert.equal(
      app.spec.egress?.type,
      "DEDICATED_IP",
      "Existing app must retain dedicated egress IPs",
    );
    assert.ok(
      (!app.in_progress_deployment && !app.pending_deployment) || !apps.length,
      "An app deployment is already running; wait before deploying again",
    );
    app = await waitFor(
      "dedicated egress IPs",
      () => one(doctl("apps", "get", app.id)),
      (current) =>
        current.dedicated_ips?.length >= 2 &&
        current.dedicated_ips.every((ip) => ip.status === "ASSIGNED"),
    );
    if (!apps.length) {
      app = await waitFor(
        "bootstrap deployment ID",
        () => one(doctl("apps", "get", app.id)),
        (current) =>
          Boolean(
            current.in_progress_deployment?.id ||
            current.pending_deployment?.id ||
            current.active_deployment?.id,
          ),
      );
      await waitForDeployment(
        app.id,
        app.in_progress_deployment?.id ||
          app.pending_deployment?.id ||
          app.active_deployment.id,
      );
    }
    app = one(doctl("apps", "get", app.id));
    assert.ok(app.live_url, "App Platform has not assigned a live URL");

    stage = "Azure resource provisioning";
    console.log(
      `Provisioning ${config.group} in Azure subscription ${config.subscription}`,
    );
    az(
      "group",
      "create",
      "--subscription",
      config.subscription,
      "--name",
      config.group,
      "--location",
      config.location,
    );
    const parameters = privateFile(
      "azure-parameters.json",
      Object.fromEntries(
        Object.entries({
          name: `${config.name}-${config.subscription.slice(0, 8)}`,
          location: config.location,
          postgresPassword: config.postgresPassword,
          egressIps: app.dedicated_ips.map((ip) => ip.ip),
        }).map(([key, value]) => [key, { value }]),
      ),
    );
    const deployment = az(
      "deployment",
      "group",
      "create",
      "--subscription",
      config.subscription,
      "--resource-group",
      config.group,
      "--name",
      "kaneo-data",
      "--mode",
      "Incremental",
      "--template-file",
      path.join(root, "deploy/digitalocean/azure.bicep"),
      "--parameters",
      `@${parameters}`,
    );
    const outputs = Object.fromEntries(
      Object.entries(deployment.properties.outputs).map(([key, output]) => [
        key,
        output.value,
      ]),
    );
    stage = "Redis key retrieval";
    const keys = az(
      "rest",
      "--method",
      "post",
      "--url",
      `https://management.azure.com${outputs.redisDatabaseId}/listKeys?api-version=2025-07-01`,
    );
    const databaseUrl = new URL(
      `postgresql://${outputs.postgresHost}/kaneo?sslmode=verify-full`,
    );
    databaseUrl.username = "kaneo";
    databaseUrl.password = config.postgresPassword;
    const redisUrl = new URL(`rediss://${outputs.redisHost}:10000`);
    redisUrl.password = keys.primaryKey;
    const publicUrl = config.domain ? `https://${config.domain}` : app.live_url;
    const runtime = {
      ...config.runtime,
      DATABASE_URL: databaseUrl.href,
      REDIS_URL: redisUrl.href,
      KANEO_CLIENT_URL: publicUrl,
      KANEO_API_URL: `${publicUrl}/api`,
      KANEO_INTERNAL_API_URL: "http://127.0.0.1:1337",
      NODE_ENV: "production",
    };
    stage = "App Platform deployment";
    const spec = appSpec(
      config,
      runtime,
      readFileSync(path.join(import.meta.dirname, "probe.mjs"), "utf8"),
    );
    app = one(
      doctl(
        "apps",
        "update",
        app.id,
        "--spec",
        privateFile("app.json", spec),
        "--update-sources",
      ),
    );
    const requested =
      app.in_progress_deployment ||
      app.pending_deployment ||
      one(doctl("apps", "create-deployment", app.id));
    console.log(
      `Requested deployment ${requested.id} for ${config.image.digest}`,
    );
    await verify(app.id, requested.id, config.image.digest);
  }
} catch (error) {
  console.error(`Deployment failed during ${stage}: ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

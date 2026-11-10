import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  appSpec,
  assertDeployment,
  configuration,
  shellQuote,
} from "./config.mjs";

const env = {
  AZURE_SUBSCRIPTION_ID: "88557392-91d3-491f-ab97-234782d07f12",
  KANEO_IMAGE: `ghcr.io/playbookmediallc/kaneo@sha256:${"a".repeat(64)}`,
  AZURE_POSTGRES_PASSWORD: "P".repeat(32),
  AUTH_SECRET: "A".repeat(64),
  NOTIFICATION_SECRET_ENCRYPTION_KEY: "N".repeat(64),
  S3_ENDPOINT:
    "https://00000000000000000000000000000000.r2.cloudflarestorage.com",
  S3_BUCKET: "kaneo-test",
  S3_ACCESS_KEY_ID: "test-access-key",
  S3_SECRET_ACCESS_KEY: "test-secret-key",
};

test("configuration fails before provisioning with missing secrets, mutable images or insecure storage", () => {
  for (const key of Object.keys(env)) {
    assert.throws(() => configuration({ ...env, [key]: "" }), undefined, key);
  }
  assert.throws(() =>
    configuration({
      ...env,
      KANEO_IMAGE: "ghcr.io/playbookmediallc/kaneo:latest",
    }),
  );
  assert.throws(() =>
    configuration({ ...env, S3_ENDPOINT: "http://storage.example.com" }),
  );
  assert.throws(() =>
    configuration({
      ...env,
      S3_ENDPOINT: "https://user:password@storage.example.com",
    }),
  );
});

test("bootstrap reserves stable outbound IPs without exposing app secrets", () => {
  const spec = appSpec(configuration(env));
  assert.equal(spec.egress.type, "DEDICATED_IP");
  assert.deepEqual(spec.envs, []);
  assert.equal(spec.services[0].http_port, 5173);
  assert.equal(spec.services[0].health_check.http_path, "/bootstrap");
  assert.equal(spec.jobs, undefined);
});

test("public onboarding and provider credentials survive deployment on a custom hostname", () => {
  const configured = {
    ...env,
    DO_APP_DOMAIN: "quills.playbookmedia.io",
    SMTP_HOST: "smtp.resend.com",
    SMTP_PASSWORD: "private-smtp-password",
    GITHUB_OAUTH_CLIENT_ID: "github-id",
    GITHUB_OAUTH_CLIENT_SECRET: "github-secret",
    GOOGLE_CLIENT_ID: "google-id",
    GOOGLE_CLIENT_SECRET: "google-secret",
    CUSTOM_OAUTH_CLIENT_ID: "workos-id",
    CUSTOM_OAUTH_CLIENT_SECRET: "workos-secret",
    CUSTOM_OAUTH_DISCOVERY_URL:
      "https://example.authkit.app/.well-known/openid-configuration",
    CUSTOM_OAUTH_NAME: "WorkOS",
    UNRELATED_SECRET: "must-not-be-deployed",
  };
  const config = configuration(configured);
  const spec = appSpec(config, config.runtime, "probe");
  assert.deepEqual(spec.domains, [
    { domain: configured.DO_APP_DOMAIN, type: "PRIMARY" },
  ]);
  for (const key of [
    "DISABLE_REGISTRATION",
    "DISABLE_PASSWORD_REGISTRATION",
    "DISABLE_EMAIL_OTP_SIGN_IN",
    "DISABLE_LOGIN_FORM",
  ]) {
    assert.equal(config.runtime[key], "false", key);
  }
  assert.equal(config.runtime.DISABLE_GUEST_ACCESS, "true");
  for (const key of [
    "SMTP_PASSWORD",
    "GITHUB_OAUTH_CLIENT_SECRET",
    "GOOGLE_CLIENT_SECRET",
    "CUSTOM_OAUTH_CLIENT_SECRET",
    "CUSTOM_OAUTH_DISCOVERY_URL",
    "CUSTOM_OAUTH_NAME",
  ]) {
    assert.equal(config.runtime[key], configured[key], key);
  }
  assert.equal(config.runtime.UNRELATED_SECRET, undefined);
  assert.equal(
    configuration({ ...env, DISABLE_REGISTRATION: "true" }).runtime
      .DISABLE_REGISTRATION,
    "true",
  );
  for (const domain of [
    "https://quills.example.com",
    "quills.example.com/path",
    "-invalid.example.com",
  ]) {
    assert.throws(() => configuration({ ...env, DO_APP_DOMAIN: domain }));
  }
  for (const prefix of ["GITHUB_OAUTH", "GOOGLE", "CUSTOM_OAUTH"]) {
    assert.throws(() =>
      configuration({ ...env, [`${prefix}_CLIENT_ID`]: "missing-secret" }),
    );
    assert.throws(() =>
      configuration({ ...env, [`${prefix}_CLIENT_SECRET`]: "missing-id" }),
    );
  }
});

test("real deployment includes a post-deploy probe using the same image, credentials and network", () => {
  const config = configuration(env);
  const probe = readFileSync(new URL("./probe.mjs", import.meta.url), "utf8");
  const spec = appSpec(config, config.runtime, probe);
  assert.equal(spec.egress.type, "DEDICATED_IP");
  assert.equal(spec.services[0].run_command, undefined);
  assert.equal(spec.services[0].health_check.http_path, "/api/health");
  assert.deepEqual(spec.jobs[0].image, spec.services[0].image);
  assert.equal(spec.jobs[0].kind, "POST_DEPLOY");
  assert.ok(
    spec.envs.every(
      (item) => item.type === "SECRET" && item.scope === "RUN_TIME",
    ),
  );
  assert.ok(!spec.jobs[0].run_command.includes(env.AUTH_SECRET));
  const payload = "apostrophe ' and $(echo unsafe)\nsecond line";
  const quoted = spawnSync("sh", ["-c", `printf %s ${shellQuote(payload)}`], {
    encoding: "utf8",
  });
  assert.equal(quoted.stdout, payload);
  const syntax = spawnSync("sh", ["-n", "-c", spec.jobs[0].run_command], {
    encoding: "utf8",
  });
  assert.equal(syntax.status, 0, syntax.stderr);
});

test("a prior green build or a failed probe cannot pass deployment validation", () => {
  const spec = appSpec(configuration(env), {}, "probe");
  const deployment = {
    id: "expected",
    phase: "ACTIVE",
    spec,
    progress: {
      steps: [
        {
          name: "build",
          status: "SUCCESS",
          steps: [
            {
              name: "verify-dependencies",
              component_name: "verify-dependencies",
              status: "SUCCESS",
            },
          ],
        },
        {
          name: "deploy",
          status: "SUCCESS",
          steps: [
            {
              name: "wait",
              component_name: "verify-dependencies",
              status: "SUCCESS",
            },
          ],
        },
      ],
    },
  };
  assertDeployment(deployment, spec.services[0].image.digest);
  for (const phase of ["ERROR", "CANCELED", "SUPERSEDED", "DEPLOYING"]) {
    assert.throws(() =>
      assertDeployment({ ...deployment, phase }, spec.services[0].image.digest),
    );
  }
  assert.throws(() => assertDeployment(deployment, `sha256:${"b".repeat(64)}`));
  const buildOnly = structuredClone(deployment);
  buildOnly.progress.steps.pop();
  assert.throws(() =>
    assertDeployment(buildOnly, spec.services[0].image.digest),
  );
  const failed = structuredClone(deployment);
  failed.progress.steps[1].steps[0].status = "ERROR";
  assert.throws(() => assertDeployment(failed, spec.services[0].image.digest));
});

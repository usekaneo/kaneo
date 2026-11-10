import assert from "node:assert/strict";

export function configuration(env) {
  const required = (key, min = 1) => {
    assert.ok(
      env[key]?.length >= min,
      `${key} must have at least ${min} characters`,
    );
    return env[key];
  };
  const name = env.DO_APP_NAME || "kaneo-production";
  assert.match(name, /^[a-z][a-z0-9-]{0,30}[a-z0-9]$/, "Invalid DO_APP_NAME");
  const image = required("KANEO_IMAGE");
  const match =
    /^ghcr\.io\/([a-z0-9-]+)\/([a-z0-9_./-]+)@(sha256:[a-f0-9]{64})$/.exec(
      image,
    );
  assert.ok(
    match,
    "KANEO_IMAGE must be a GHCR image pinned to a sha256 digest",
  );
  const subscription = required("AZURE_SUBSCRIPTION_ID");
  assert.match(
    subscription,
    /^[a-f0-9-]{36}$/i,
    "Invalid AZURE_SUBSCRIPTION_ID",
  );
  const domain = env.DO_APP_DOMAIN;
  if (domain) {
    assert.match(
      domain,
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
      "DO_APP_DOMAIN must be a hostname without a scheme or path",
    );
  }
  for (const prefix of ["GITHUB_OAUTH", "GOOGLE", "CUSTOM_OAUTH"]) {
    assert.equal(
      Boolean(env[`${prefix}_CLIENT_ID`]),
      Boolean(env[`${prefix}_CLIENT_SECRET`]),
      `${prefix} requires both a client ID and client secret`,
    );
  }
  const s3Endpoint = new URL(required("S3_ENDPOINT"));
  assert.equal(s3Endpoint.protocol, "https:", "S3_ENDPOINT must use HTTPS");
  assert.match(
    s3Endpoint.hostname,
    /^[a-f0-9]{32}(?:\.(?:eu|us|fedramp))?\.r2\.cloudflarestorage\.com$/,
    "S3_ENDPOINT must be an R2 S3 endpoint",
  );
  assert.ok(
    !s3Endpoint.username &&
      !s3Endpoint.password &&
      s3Endpoint.pathname === "/" &&
      !s3Endpoint.search &&
      !s3Endpoint.hash,
    "S3_ENDPOINT must not contain credentials, a bucket path or query parameters",
  );
  return {
    name,
    domain,
    subscription,
    group: env.AZURE_RESOURCE_GROUP || `${name}-data`,
    location: env.AZURE_LOCATION || "northcentralus",
    region: env.DO_REGION || "nyc",
    size: env.DO_INSTANCE_SIZE || "apps-s-1vcpu-1gb",
    image: {
      registry_type: "GHCR",
      registry: match[1],
      repository: match[2],
      digest: match[3],
      ...(env.GHCR_CREDENTIALS
        ? { registry_credentials: env.GHCR_CREDENTIALS }
        : {}),
    },
    postgresPassword: required("AZURE_POSTGRES_PASSWORD", 32),
    runtime: {
      AUTH_SECRET: required("AUTH_SECRET", 32),
      NOTIFICATION_SECRET_ENCRYPTION_KEY: required(
        "NOTIFICATION_SECRET_ENCRYPTION_KEY",
        32,
      ),
      S3_ENDPOINT: s3Endpoint.href.replace(/\/$/, ""),
      S3_BUCKET: required("S3_BUCKET"),
      S3_ACCESS_KEY_ID: required("S3_ACCESS_KEY_ID"),
      S3_SECRET_ACCESS_KEY: required("S3_SECRET_ACCESS_KEY"),
      S3_REGION: env.S3_REGION || "auto",
      S3_FORCE_PATH_STYLE: "true",
      DISABLE_GUEST_ACCESS: "true",
      DISABLE_REGISTRATION: env.DISABLE_REGISTRATION || "false",
      DISABLE_PASSWORD_REGISTRATION:
        env.DISABLE_PASSWORD_REGISTRATION || "false",
      DISABLE_EMAIL_OTP_SIGN_IN: env.DISABLE_EMAIL_OTP_SIGN_IN || "false",
      DISABLE_LOGIN_FORM: env.DISABLE_LOGIN_FORM || "false",
      ...Object.fromEntries(
        Object.entries(env).filter(
          ([key, value]) =>
            value &&
            (key.startsWith("SMTP_") ||
              key.startsWith("CUSTOM_OAUTH_") ||
              [
                "CUSTOM_AUTH_PKCE",
                "GITHUB_OAUTH_CLIENT_ID",
                "GITHUB_OAUTH_CLIENT_SECRET",
                "GOOGLE_CLIENT_ID",
                "GOOGLE_CLIENT_SECRET",
              ].includes(key)),
        ),
      ),
    },
  };
}

export const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

export function appSpec(config, runtime, probeSource) {
  const bootstrap = !runtime;
  const component = { image: config.image, instance_size_slug: config.size };
  return {
    name: config.name,
    region: config.region,
    ...(config.domain
      ? { domains: [{ domain: config.domain, type: "PRIMARY" }] }
      : {}),
    egress: { type: "DEDICATED_IP" },
    alerts: [{ rule: "DEPLOYMENT_FAILED" }],
    ingress: {
      rules: [
        { component: { name: "kaneo" }, match: { path: { prefix: "/" } } },
      ],
    },
    envs: Object.entries(runtime || {}).map(([key, value]) => ({
      key,
      value,
      type: "SECRET",
      scope: "RUN_TIME",
    })),
    services: [
      {
        ...component,
        name: "kaneo",
        http_port: 5173,
        instance_count: 1,
        health_check: {
          http_path: bootstrap ? "/bootstrap" : "/api/health",
          initial_delay_seconds: 30,
          period_seconds: 10,
          timeout_seconds: 5,
          failure_threshold: 12,
        },
        ...(bootstrap
          ? {
              run_command: `node -e ${shellQuote("require('http').createServer((req,res)=>res.end('Preparing Kaneo')).listen(5173,'0.0.0.0')")}`,
            }
          : {}),
      },
    ],
    ...(!bootstrap
      ? {
          jobs: [
            {
              ...component,
              name: "verify-dependencies",
              kind: "POST_DEPLOY",
              run_command: `sh -c ${shellQuote(`cd /app/apps/api && node --input-type=module -e ${shellQuote(probeSource)}`)}`,
            },
          ],
        }
      : {}),
  };
}

export function assertDeployment(deployment, digest) {
  assert.equal(
    deployment.phase,
    "ACTIVE",
    `Deployment ${deployment.id} is ${deployment.phase}`,
  );
  assert.equal(
    deployment.spec.services[0].image.digest,
    digest,
    "Deployment has a different image digest",
  );
  assert.equal(
    deployment.spec.jobs?.[0]?.name,
    "verify-dependencies",
    "Dependency verification job missing",
  );
  assert.equal(deployment.spec.jobs[0].kind, "POST_DEPLOY");
  const steps = [];
  const collect = (items) => {
    for (const item of items || []) {
      steps.push(item);
      collect(item.steps);
    }
  };
  collect(deployment.progress?.steps?.filter((step) => step.name !== "build"));
  assert.ok(
    steps.some(
      (step) =>
        step.component_name === "verify-dependencies" &&
        step.name === "wait" &&
        step.status === "SUCCESS",
    ),
    "Dependency verification job did not succeed",
  );
}

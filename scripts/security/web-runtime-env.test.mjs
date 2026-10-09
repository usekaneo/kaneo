import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

const root = resolve(import.meta.dirname, "../..");
// Uses the production standalone-web runtime, without networking or published ports.
// Pull this public image explicitly before running the test; never pull implicitly.
const image = "nginx:1.29.5-alpine";
const scenarios = [
  {
    name: "ordinary URLs",
    api: "https://api.example.test/api/",
    client: "https://app.example.test",
    key: "site-key",
  },
  {
    name: "literal punctuation, control characters, UTF-8, and placeholder-like data",
    api: 'https://api.example.test/a&b/$host/"quoted"/\\path/api#fragment',
    client:
      // eslint-disable-next-line no-template-curly-in-string -- Must remain literal hostile configuration data.
      "https://app.example.test/#'\"` ${globalThis.injected = true} & \\ \n\r\t\u0001\u001f Grüße 😀 \u2028\u2029",
    key: 'KANEO_CLIENT_URL ";globalThis.injected=true;//',
  },
  { name: "unset public values", api: "", client: "", key: "" },
];

test("production runtime serves configuration with default and restricted users", async (t) => {
  const fixture = mkdtempSync(resolve(tmpdir(), "kaneo-web-runtime-"));
  const runtimeImage = `kaneo-web-runtime-test:${process.pid}`;
  const container = `kaneo-web-runtime-test-${process.pid}`;
  const docker = (args, timeout = 30_000) => {
    const result = spawnSync("docker", args, { encoding: "utf8", timeout });
    assert.equal(result.status, 0, result.error?.message ?? result.stderr);
    return result.stdout;
  };
  try {
    mkdirSync(resolve(fixture, "dist/assets"), { recursive: true });
    mkdirSync(resolve(fixture, "apps/web"), { recursive: true });
    writeFileSync(resolve(fixture, "dist/index.html"), "runtime fixture");
    for (const asset of ["root.js", "assets/app.js"]) {
      writeFileSync(resolve(fixture, "dist", asset), '"KANEO_API_URL"');
    }
    writeFileSync(resolve(fixture, "dist/hook.js"), '"KANEO_CLIENT_URL"');
    const hook = resolve(fixture, "00-test.envsh");
    writeFileSync(
      hook,
      'export KANEO_CLIENT_URL="https://hook.example.test"\n',
      {
        mode: 0o755,
      },
    );
    const template = resolve(fixture, "runtime.conf.template");
    writeFileSync(
      template,
      'server { listen 5174; return 200 "$KANEO_CLIENT_URL"; }\n',
    );
    for (const file of ["nginx.conf", "nginx.main.conf", "env.sh", "env.awk"]) {
      copyFileSync(
        resolve(root, "apps/web", file),
        resolve(fixture, "apps/web", file),
      );
    }
    // Exercise the real runtime stage, substituting only the frontend build.
    // A writable bind mount over the web root would hide image ownership bugs.
    const dockerfile = readFileSync(
      resolve(root, "apps/web/Dockerfile"),
      "utf8",
    );
    const runtime = dockerfile.match(/^FROM nginx:.* AS runtime\r?\n[\s\S]*/m);
    assert.ok(runtime, "standalone web runtime stage must exist");
    writeFileSync(
      resolve(fixture, "Dockerfile"),
      `FROM scratch AS builder\nCOPY dist /app/apps/web/dist\n${runtime[0]}`,
    );
    docker(["image", "inspect", image]);
    docker(["build", "--network=none", "-t", runtimeImage, fixture], 120_000);
    for (const scenario of [
      {
        name: "default non-root user with nginx template",
        uid: "1001",
        args: [
          "--mount",
          `type=bind,source=${template},target=/etc/nginx/templates/runtime.conf.template,readonly`,
        ],
      },
      {
        name: "arbitrary OpenShift UID",
        uid: "1001230000",
        args: ["--user=1001230000:0"],
      },
      {
        name: "arbitrary UID and read-only root with writable volume",
        uid: "1001230000",
        args: [
          "--user=1001230000:1001230000",
          "--read-only",
          "--tmpfs=/var/lib/kaneo:rw,mode=0770,gid=1001230000",
          "--cap-drop=ALL",
          "--security-opt=no-new-privileges",
        ],
      },
    ]) {
      await t.test(scenario.name, () => {
        const output = docker([
          "run",
          "--rm",
          "--name",
          container,
          "--pull=never",
          "--network=none",
          ...scenario.args,
          "--mount",
          `type=bind,source=${hook},target=/docker-entrypoint.d/00-test.envsh,readonly`,
          "--env",
          "KANEO_API_URL=https://api.example.test/api",
          runtimeImage,
          "sh",
          "-eu",
          "-c",
          [
            `test "$(id -u)" = ${scenario.uid}`,
            "test ! -d /var/lib/kaneo/html",
            'test "$(cat /usr/share/nginx/html/root.js)" = \'"KANEO_API_URL"\'',
            "/docker-entrypoint.sh nginx -t",
            'test "$(cat /var/lib/kaneo/html/hook.js)" = \'"https://hook.example.test"\'',
            'test "$(cat /var/lib/kaneo/html/mcp-oauth-resource.json)" != "{}"',
            "KANEO_API_URL=https://changed.example.test/api /docker-entrypoint.d/env.sh",
            'test "$(cat /var/lib/kaneo/html/root.js)" = \'"https://changed.example.test/api"\'',
            "/docker-entrypoint.d/env.sh",
            "nginx -t",
            "nginx > /var/lib/kaneo/tmp/nginx-output.log 2>&1",
            'test "$(wget -qO- http://127.0.0.1:5173/)" = "runtime fixture"',
            'if [ "$(id -u)" = 1001 ]; then test "$(wget -qO- http://127.0.0.1:5174/)" = "https://hook.example.test"; fi',
            "wget -qO- http://127.0.0.1:5173/root.js",
            "wget -qO- http://127.0.0.1:5173/assets/app.js",
            "wget -qO- http://127.0.0.1:5173/.well-known/oauth-protected-resource/api/mcp",
            "wget -qO- http://127.0.0.1:5173/.well-known/oauth-authorization-server/api",
            "nginx -s quit",
          ].join("; "),
        ]);
        const responses = output
          .trim()
          .split("\n")
          .slice(-4)
          .map((line) => JSON.parse(line));
        assert.equal(responses[0], "https://api.example.test/api");
        assert.equal(responses[1], "https://api.example.test/api");
        assert.equal(responses[2].resource, "https://api.example.test/api/mcp");
        assert.equal(responses[3].issuer, "https://api.example.test/api");
      });
    }
  } finally {
    spawnSync("docker", ["rm", "-f", container], { timeout: 30_000 });
    spawnSync("docker", ["image", "rm", runtimeImage], { timeout: 30_000 });
    rmSync(fixture, { recursive: true, force: true });
  }
});

for (const scenario of scenarios) {
  test(scenario.name, () => {
    const fixture = mkdtempSync(resolve(tmpdir(), "kaneo-web-env-"));
    try {
      chmodSync(fixture, 0o777);
      mkdirSync(resolve(fixture, "dist"));
      mkdirSync(resolve(fixture, "runtime"), { mode: 0o777 });
      chmodSync(resolve(fixture, "runtime"), 0o777);
      const assetName = "app with spaces\nand newline.js";
      const asset = resolve(fixture, "dist", assetName);
      writeFileSync(
        asset,
        'globalThis.config = {api:"KANEO_API_URL",client:\'KANEO_CLIENT_URL\',callback:`KANEO_CLIENT_URL/auth/sign-in`,key:`KANEO_TURNSTILE_SITE_KEY`,private:"KANEO_SERVER_SECRET"};\n',
      );
      copyFileSync(
        resolve(root, "apps/web/nginx.conf"),
        resolve(fixture, "server.conf"),
      );
      const result = spawnSync(
        "docker",
        [
          "run",
          "--rm",
          "--pull=never",
          "--network=none",
          "--user=1001:1001",
          "--read-only",
          "--mount",
          `type=bind,source=${resolve(fixture, "dist")},target=/usr/share/nginx/html,readonly`,
          "--mount",
          `type=bind,source=${resolve(fixture, "runtime")},target=/var/lib/kaneo`,
          "--mount",
          `type=bind,source=${resolve(root, "apps/web/nginx.main.conf")},target=/etc/nginx/nginx.conf,readonly`,
          "--mount",
          `type=bind,source=${resolve(fixture, "server.conf")},target=/etc/nginx/conf.d/default.conf,readonly`,
          "--mount",
          `type=bind,source=${resolve(root, "apps/web")},target=/renderer,readonly`,
          "--env",
          "KANEO_API_URL",
          "--env",
          "KANEO_CLIENT_URL",
          "--env",
          "KANEO_TURNSTILE_SITE_KEY",
          "--env",
          "KANEO_SERVER_SECRET",
          "--entrypoint",
          "sh",
          image,
          "-eu",
          "-c",
          "sh /renderer/env.sh; nginx -t; nginx; wget -qO /var/lib/kaneo/resource-response.json http://127.0.0.1:5173/.well-known/oauth-protected-resource/api/mcp; wget -qO /var/lib/kaneo/authorization-response.json http://127.0.0.1:5173/.well-known/oauth-authorization-server/api; nginx -s quit",
        ],
        {
          encoding: "utf8",
          timeout: 30_000,
          env: {
            ...process.env,
            KANEO_API_URL: scenario.api,
            KANEO_CLIENT_URL: scenario.client,
            KANEO_TURNSTILE_SITE_KEY: scenario.key,
            KANEO_SERVER_SECRET: "must-not-be-published",
          },
        },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.ok(readFileSync(asset, "utf8").includes('api:"KANEO_API_URL"'));
      const source = readFileSync(
        resolve(fixture, "runtime/html", assetName),
        "utf8",
      );
      const context = {};
      runInNewContext(source, context);
      assert.equal(context.config.api, scenario.api);
      assert.equal(context.config.client, scenario.client);
      assert.equal(context.config.callback, `${scenario.client}/auth/sign-in`);
      assert.equal(context.config.key, scenario.key);
      assert.equal(context.config.private, "KANEO_SERVER_SECRET");
      assert.equal(context.injected, undefined);
      assert.ok(!source.includes("must-not-be-published"));
      assert.ok(!result.stdout.includes("site-key"));
      const resource = JSON.parse(
        readFileSync(
          resolve(fixture, "runtime/resource-response.json"),
          "utf8",
        ),
      );
      const authorization = JSON.parse(
        readFileSync(
          resolve(fixture, "runtime/authorization-response.json"),
          "utf8",
        ),
      );
      if (!scenario.api) {
        assert.deepEqual(resource, {});
        assert.deepEqual(authorization, {});
      } else {
        const base = scenario.api
          .replace(/[?#].*$/, "")
          .replace(/\/*$/, "")
          .replace(/\/api$/, "");
        assert.equal(resource.resource, `${base}/api/mcp`);
        assert.deepEqual(resource.authorization_servers, [`${base}/api`]);
        assert.equal(authorization.issuer, `${base}/api`);
        assert.equal(
          authorization.registration_endpoint,
          `${base}/api/mcp/register`,
        );
      }
      assert.equal(
        readFileSync(resolve(fixture, "server.conf"), "utf8"),
        readFileSync(resolve(root, "apps/web/nginx.conf"), "utf8"),
      );
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
}

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
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
      // biome-ignore lint/suspicious/noTemplateCurlyInString: Must remain literal hostile configuration data.
      "https://app.example.test/#'\"` ${globalThis.injected = true} & \\ \n\r\t\u0001\u001f Grüße 😀 \u2028\u2029",
    key: 'KANEO_CLIENT_URL ";globalThis.injected=true;//',
  },
  { name: "unset public values", api: "", client: "", key: "" },
];

for (const scenario of scenarios) {
  test(scenario.name, () => {
    const fixture = mkdtempSync(resolve(tmpdir(), "kaneo-web-env-"));
    try {
      chmodSync(fixture, 0o777);
      const asset = resolve(fixture, "app with spaces\nand newline.js");
      writeFileSync(
        asset,
        'globalThis.config = {api:"KANEO_API_URL",client:\'KANEO_CLIENT_URL\',callback:`KANEO_CLIENT_URL/auth/sign-in`,key:`KANEO_TURNSTILE_SITE_KEY`,private:"KANEO_SERVER_SECRET"};\n',
      );
      copyFileSync(
        resolve(root, "apps/web/nginx.conf"),
        resolve(fixture, "server.conf"),
      );
      writeFileSync(
        resolve(fixture, "nginx.conf"),
        "pid /tmp/nginx.pid;\nerror_log /tmp/nginx-error.log;\nevents {}\nhttp { access_log off; client_body_temp_path /tmp/client; proxy_temp_path /tmp/proxy; fastcgi_temp_path /tmp/fastcgi; uwsgi_temp_path /tmp/uwsgi; scgi_temp_path /tmp/scgi; include /usr/share/nginx/html/server.conf; }\n",
      );
      const result = spawnSync(
        "docker",
        [
          "run",
          "--rm",
          "--pull=never",
          "--network=none",
          "--user=1001:1001",
          "--mount",
          `type=bind,source=${fixture},target=/usr/share/nginx/html`,
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
          "sh /renderer/env.sh; nginx -t -c /usr/share/nginx/html/nginx.conf; nginx -c /usr/share/nginx/html/nginx.conf; wget -qO /usr/share/nginx/html/resource-response.json http://127.0.0.1:5173/.well-known/oauth-protected-resource/api/mcp; wget -qO /usr/share/nginx/html/authorization-response.json http://127.0.0.1:5173/.well-known/oauth-authorization-server/api; nginx -s quit -c /usr/share/nginx/html/nginx.conf",
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
      const source = readFileSync(asset, "utf8");
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
        readFileSync(resolve(fixture, "resource-response.json"), "utf8"),
      );
      const authorization = JSON.parse(
        readFileSync(resolve(fixture, "authorization-response.json"), "utf8"),
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

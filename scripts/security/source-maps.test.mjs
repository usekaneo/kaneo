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

const root = resolve(import.meta.dirname, "../..");
for (const config of ["nginx.conf", "nginx.kaneo.conf"]) {
  test(`${config} refuses existing source maps and still serves the application`, () => {
    const fixture = mkdtempSync(resolve(tmpdir(), "kaneo-map-test-"));
    try {
      chmodSync(fixture, 0o777);
      mkdirSync(resolve(fixture, "assets"));
      writeFileSync(
        resolve(fixture, "assets/app.js"),
        "globalThis.ready = true;",
      );
      writeFileSync(
        resolve(fixture, "assets/app.js.map"),
        '{"sourcesContent":["private-source-marker"]}',
      );
      writeFileSync(
        resolve(fixture, "assets/app.JS.MAP"),
        '{"sourcesContent":["private-source-marker"]}',
      );
      writeFileSync(resolve(fixture, "index.html"), "application-shell");
      copyFileSync(
        resolve(root, "apps/web", config),
        resolve(fixture, "server.conf"),
      );
      writeFileSync(
        resolve(fixture, "nginx.conf"),
        "pid /tmp/nginx.pid; error_log /tmp/nginx-error.log; events {} http { access_log off; client_body_temp_path /tmp/client; proxy_temp_path /tmp/proxy; fastcgi_temp_path /tmp/fastcgi; uwsgi_temp_path /tmp/uwsgi; scgi_temp_path /tmp/scgi; include /usr/share/nginx/html/server.conf; }",
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
          "--entrypoint",
          "sh",
          "nginx:1.29.5-alpine",
          "-eu",
          "-c",
          `
nginx -t -c /usr/share/nginx/html/nginx.conf
nginx -c /usr/share/nginx/html/nginx.conf
trap 'nginx -s quit -c /usr/share/nginx/html/nginx.conf' EXIT
for path in assets/app.js.map assets/app.JS.MAP assets/app.js%2emap; do
  if wget -S -O /tmp/map-body "http://127.0.0.1:5173/$path" 2>/tmp/map-headers; then exit 1; fi
  grep -q '404 Not Found' /tmp/map-headers
  if grep -q private-source-marker /tmp/map-body; then exit 1; fi
done
wget -qO /usr/share/nginx/html/js-response http://127.0.0.1:5173/assets/app.js
wget -qO /usr/share/nginx/html/page-response http://127.0.0.1:5173/dashboard
`,
        ],
        { encoding: "utf8", timeout: 30_000 },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        readFileSync(resolve(fixture, "js-response"), "utf8"),
        "globalThis.ready = true;",
      );
      assert.equal(
        readFileSync(resolve(fixture, "page-response"), "utf8"),
        "application-shell",
      );
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
}

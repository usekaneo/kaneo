import assert from "node:assert/strict";
import { once } from "node:events";
import { request } from "node:http";
import { createRequire } from "node:module";
import test from "node:test";

const apiRequire = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
);
const { createAdaptorServer } = apiRequire("@hono/node-server");

async function withServer(check) {
  const received = [];
  const server = createAdaptorServer({
    fetch(req) {
      received.push(req.url);
      return new Response(req.url);
    },
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await check(server.address().port, received);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

// Send the original request-target without a URL parser normalizing it first.
function send(port, path) {
  return new Promise((resolve, reject) => {
    const req = request(
      { hostname: "127.0.0.1", port, path, agent: false },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body }));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.setTimeout(5000, () => req.destroy(new Error("Request timed out")));
    req.end();
  });
}

test("the API's Node adapter rejects raw path backslashes before dispatch", async () => {
  await withServer(async (port, received) => {
    for (const path of [
      "/admin\\secret",
      "/public\\..\\admin/secret",
      "/public\\%2e%2e\\admin/secret",
      "http://localhost/admin\\secret",
    ]) {
      assert.equal((await send(port, path)).status, 400, path);
    }
    assert.deepEqual(received, []);
  });
});

test("the API's Node adapter retains ordinary, encoded and query paths", async () => {
  await withServer(async (port, received) => {
    for (const path of [
      "/api/health",
      "/admin%5Csecret",
      "/public?q=\\admin\\secret",
    ]) {
      const response = await send(port, path);
      assert.equal(response.status, 200, path);
      assert.equal(response.body, `http://127.0.0.1:${port}${path}`);
    }
    assert.equal(received.length, 3);
  });
});

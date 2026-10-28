import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import test from "node:test";

// Resolve BrowserStack's actual dependency, without loading its SDK or credentials.
const require = createRequire(import.meta.url);
const sdkRequire = createRequire(
  require.resolve("browserstack-node-sdk/package.json"),
);
const { http } = sdkRequire("follow-redirects");

for (const arrayHeaders of [false, true]) {
  test(`redirects strip credentials with ${arrayHeaders ? "array" : "object"} headers`, async (t) => {
    const received = [];
    const server = createServer((req, res) => {
      received.push(req.headers);
      if (req.url === "/start") {
        // Both addresses are loopback, but their hostnames cross an origin boundary.
        res.writeHead(302, {
          location: `http://localhost:${server.address().port}/end`,
        });
      }
      res.end("synthetic response");
    });
    server.listen(0, "127.0.0.1");
    t.after(() => new Promise((resolve) => server.close(resolve)));
    await once(server, "listening");

    const headers = {
      Authorization: "Bearer synthetic-only",
      "Proxy-Authorization": "Basic synthetic-only",
      Cookie: "session=synthetic-only",
      "X-Token^Key": "synthetic-caret",
      "X-Token|Key": "synthetic-pipe",
      "X-Public": "preserved",
    };
    await new Promise((resolve, reject) => {
      const request = http.get(
        `http://127.0.0.1:${server.address().port}/start`,
        {
          family: 4,
          headers: arrayHeaders ? Object.entries(headers).flat() : headers,
          sensitiveHeaders: ["X-Token^Key", "X-Token|Key"],
        },
        (response) => {
          response.resume();
          response.on("end", resolve);
          response.on("error", reject);
        },
      );
      request.on("error", reject);
      request.setTimeout(5_000, () =>
        request.destroy(new Error("redirect timed out")),
      );
    });

    assert.equal(received.length, 2);
    for (const name of Object.keys(headers)) {
      assert.equal(received[0][name.toLowerCase()], headers[name]);
      assert.equal(
        received[1][name.toLowerCase()],
        name === "X-Public" ? "preserved" : undefined,
      );
    }
  });
}

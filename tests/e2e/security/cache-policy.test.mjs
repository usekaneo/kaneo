import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";

const require = createRequire(import.meta.url);
const sdk = createRequire(
  require.resolve("browserstack-node-sdk/package.json"),
);
const notifier = createRequire(sdk.resolve("update-notifier"));
const latestVersion = createRequire(notifier.resolve("latest-version"));
const packageJson = createRequire(latestVersion.resolve("package-json"));

// Exercise both installed consumers; do not load BrowserStack or its credentials.
for (const [name, consumer] of [
  ["SDK", sdk],
  ["update notifier", packageJson],
]) {
  const got = createRequire(consumer.resolve("got"));
  const cache = createRequire(got.resolve("cacheable-request"));
  const Base = cache("http-cache-semantics");
  let clock = 100_000;
  class Policy extends Base {
    now() {
      return clock;
    }
  }
  const request = (headers = {}) => ({
    url: "https://cache.invalid/account",
    method: "GET",
    headers: { host: "cache.invalid", ...headers },
  });
  const make = (cc, extra = {}, reqExtra = {}, shared = true) => {
    clock = 100_000;
    return new Policy(
      request(reqExtra),
      {
        status: 200,
        headers: { "cache-control": cc, etag: '"same"', ...extra },
      },
      { shared },
    );
  };
  const staleRequest = request({ "cache-control": "max-stale=999999" });
  const cookie = { "set-cookie": "session=synthetic-only; HttpOnly" };

  for (const cc of [
    "max-age=60",
    "immutable, max-age=60",
    "must-revalidate, max-age=60",
    "s-maxage=60",
  ]) {
    test(`${name}: shared cookies require explicit sharing: ${cc}`, () => {
      const policy = make(cc, cookie);
      assert.equal(policy.storable(), false);
      assert.equal(policy.satisfiesWithoutRevalidation(request()), false);
      assert.equal(policy.satisfiesWithoutRevalidation(staleRequest), false);
    });
  }
  for (const cc of ["private, max-age=60", "no-store, max-age=60"]) {
    test(`${name}: max-stale cannot reuse ${cc}`, () => {
      assert.equal(make(cc).satisfiesWithoutRevalidation(staleRequest), false);
    });
  }
  test(`${name}: authorization requires explicit sharing`, () => {
    const policy = make(
      "max-age=60",
      {},
      { authorization: "Bearer synthetic" },
    );
    assert.equal(policy.storable(), false);
    assert.equal(policy.satisfiesWithoutRevalidation(staleRequest), false);
  });

  for (const cc of [
    "no-cache, max-age=60",
    "proxy-revalidate, max-age=1",
    "s-maxage=1",
    "s-maxage=0",
    "must-revalidate, max-age=1",
  ]) {
    test(`${name}: stale requests and extensions cannot bypass ${cc}`, () => {
      const policy = make(
        `${cc}, stale-while-revalidate=60, stale-if-error=60`,
      );
      clock += 2_000;
      assert.equal(policy.satisfiesWithoutRevalidation(staleRequest), false);
      assert.equal(policy.evaluateRequest(request()).response, undefined);
      assert.equal(policy.useStaleWhileRevalidate(), false);
      assert.equal(
        policy.revalidatedPolicy(request(), { status: 500, headers: {} })
          .modified,
        true,
      );
    });
  }
  for (const cc of [
    "public, max-age=60",
    "s-maxage=60",
    "must-revalidate, max-age=60",
  ]) {
    test(`${name}: fresh explicit sharing works: ${cc}`, () => {
      const policy = make(cc, {}, { authorization: "Bearer synthetic" });
      clock += 2_000;
      assert.equal(policy.storable(), true);
      assert.equal(policy.satisfiesWithoutRevalidation(request()), true);
    });
  }
  test(`${name}: public cookie responses remain reusable`, () => {
    assert.equal(
      make("public, max-age=60", cookie).satisfiesWithoutRevalidation(
        request(),
      ),
      true,
    );
  });
  test(
    `${name}: actual HTTP client caches public cookies and refuses implicit cookie sharing`,
    { timeout: 15_000 },
    async (t) => {
      const { default: client } = await import(
        pathToFileURL(consumer.resolve("got")).href
      );
      const counts = new Map();
      const server = createServer((req, res) => {
        const count = (counts.get(req.url) ?? 0) + 1;
        counts.set(req.url, count);
        if (
          req.url === "/revalidate" &&
          req.headers["if-none-match"] === '"security-etag"'
        ) {
          res.writeHead(304, {
            "cache-control": "public, max-age=0",
            etag: '"security-etag"',
          });
          res.end();
          return;
        }
        const cacheControl = {
          "/public": "public, max-age=60",
          "/restricted": "must-revalidate, max-age=60",
          "/immutable": "immutable, max-age=60",
          "/revalidate": "public, max-age=0",
        };
        res.writeHead(200, {
          "cache-control": cacheControl[req.url],
          "set-cookie": "session=synthetic-only; HttpOnly",
          etag: '"security-etag"',
        });
        res.end(String(count));
      });
      t.after(() => {
        server.closeAllConnections();
        return new Promise((resolve) => server.close(resolve));
      });
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      for (const path of [
        "/public",
        "/restricted",
        "/immutable",
        "/revalidate",
      ]) {
        const url = `http://127.0.0.1:${server.address().port}${path}`;
        const options = {
          cache: new Map(),
          retry: { limit: 0 },
          timeout: { request: 5_000 },
          headers: { connection: "close" },
        };
        assert.equal(await client(url, options).text(), "1");
        const cacheable = path === "/public" || path === "/revalidate";
        if (cacheable) {
          for (
            let attempt = 0;
            options.cache.size === 0 && attempt < 100;
            attempt += 1
          ) {
            await delay(10);
          }
          assert.ok(
            options.cache.size > 0,
            "wait for the asynchronous cache write",
          );
        }
        assert.equal(await client(url, options).text(), cacheable ? "1" : "2");
        assert.equal(counts.get(path), path === "/public" ? 1 : 2);
      }
    },
  );
  test(`${name}: fresh proxy-revalidate response remains reusable`, () => {
    assert.equal(
      make("proxy-revalidate, max-age=60").satisfiesWithoutRevalidation(
        request(),
      ),
      true,
    );
  });
  test(`${name}: private cache retains cookies and ignores shared revalidation directives`, () => {
    const policy = make(
      "private, proxy-revalidate, s-maxage=0, max-age=1",
      cookie,
      {},
      false,
    );
    clock += 2_000;
    assert.equal(policy.satisfiesWithoutRevalidation(staleRequest), true);
  });
  test(`${name}: ordinary stale reuse and extensions remain available`, () => {
    const policy = make(
      "max-age=1, stale-while-revalidate=60, stale-if-error=60",
    );
    clock += 2_000;
    assert.equal(policy.satisfiesWithoutRevalidation(staleRequest), true);
    assert.ok(policy.evaluateRequest(request()).response);
    assert.equal(
      policy.revalidatedPolicy(request(), { status: 500, headers: {} })
        .modified,
      false,
    );
    const noCache = request({ "cache-control": "no-cache" });
    assert.equal(
      policy.revalidatedPolicy(noCache, { status: 500, headers: {} }).modified,
      true,
    );
  });
  test(`${name}: restored cookie entries cannot replay on hits, 304s, or errors`, () => {
    const policy = make(
      "max-age=0, stale-if-error=60, stale-while-revalidate=60",
      cookie,
    );
    // Serialization format is unchanged, including entries retained before the patch.
    const restored = Policy.fromObject(
      JSON.parse(JSON.stringify(policy.toObject())),
    );
    clock += 2_000;
    assert.equal(restored.satisfiesWithoutRevalidation(staleRequest), false);
    assert.equal(restored.evaluateRequest(request()).response, undefined);
    assert.equal(
      restored.revalidationHeaders(request())["if-none-match"],
      undefined,
    );
    for (const response of [
      { status: 304, headers: { etag: '"same"' } },
      { status: 500, headers: {} },
    ]) {
      const result = restored.revalidatedPolicy(request(), response);
      assert.equal(result.matches, false);
      assert.equal(result.modified, true);
    }
  });
  test(`${name}: legitimate no-cache 304 validates only the current reuse`, () => {
    const result = make("no-cache").revalidatedPolicy(request(), {
      status: 304,
      headers: { etag: '"same"' },
    });
    assert.equal(result.modified, false);
    assert.equal(
      result.policy.satisfiesWithoutRevalidation(staleRequest),
      false,
    );
  });
  test(`${name}: 304 preserves newly introduced restrictions and cookies`, () => {
    for (const cc of ["private", "no-store", "no-cache"]) {
      const result = make("max-age=0").revalidatedPolicy(request(), {
        status: 304,
        headers: { etag: '"same"', "cache-control": cc, ...cookie },
      });
      assert.equal(result.policy.storable(), false);
      assert.equal(
        result.policy.responseHeaders()["set-cookie"],
        cookie["set-cookie"],
      );
    }
    // Restriction was absent entirely from the original representation.
    const policy = new Policy(request(), {
      status: 200,
      headers: { etag: '"same"' },
    });
    const result = policy.revalidatedPolicy(request(), {
      status: 304,
      headers: { etag: '"same"', "cache-control": "private" },
    });
    assert.equal(result.policy.storable(), false);
  });
  test(`${name}: revalidation cannot replay a different representation`, () => {
    const policy = make("public, max-age=0");
    const differentUrl = { ...request(), url: "https://cache.invalid/other" };
    assert.equal(
      policy.revalidatedPolicy(differentUrl, {
        status: 304,
        headers: { etag: '"same"' },
      }).modified,
      true,
    );
    assert.equal(
      policy.revalidatedPolicy(request(), {
        status: 304,
        headers: { etag: '"different"' },
      }).modified,
      true,
    );
    const varied = make(
      "public, max-age=60",
      { vary: "cookie" },
      { cookie: "user=alice" },
    );
    assert.equal(
      varied.satisfiesWithoutRevalidation(request({ cookie: "user=bob" })),
      false,
    );
  });
}

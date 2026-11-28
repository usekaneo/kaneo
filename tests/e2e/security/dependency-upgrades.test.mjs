import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const sdkRequire = createRequire(require.resolve("browserstack-node-sdk"));

test("the browser-test HTTP client strips cross-realm custom credentials on redirects", async () => {
  const { http } = sdkRequire("follow-redirects");
  const destination = createServer((req, res) =>
    res.end(JSON.stringify(req.headers)),
  );
  const source = createServer((_req, res) => {
    res.writeHead(302, {
      location: `http://127.0.0.1:${destination.address().port}/`,
    });
    res.end();
  });
  const listen = (server) =>
    new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await listen(destination);
    await listen(source);
    const headers = await new Promise((resolve, reject) => {
      http
        .get(
          `http://127.0.0.1:${source.address().port}/`,
          {
            headers: {
              "x-kaneo-test-secret": "synthetic",
              "x-kaneo-test-public": "kept",
            },
            sensitiveHeaders: runInNewContext("['x-kaneo-test-secret']"),
          },
          (response) => {
            let body = "";
            response.setEncoding("utf8");
            response.on("data", (chunk) => {
              body += chunk;
            });
            response.on("end", () => resolve(JSON.parse(body)));
          },
        )
        .on("error", reject);
    });
    assert.equal(headers["x-kaneo-test-secret"], undefined);
    assert.equal(headers["x-kaneo-test-public"], "kept");
  } finally {
    source.closeAllConnections();
    destination.closeAllConnections();
    await Promise.all(
      [source, destination].map(
        (s) => new Promise((resolve) => s.close(resolve)),
      ),
    );
  }
});

test("BrowserStack's archiver retains glob matching and ignore rules after the dependency upgrades", async () => {
  const archive = sdkRequire("archiver")("zip");
  const directory = await mkdtemp(join(tmpdir(), "kaneo-archive-security-"));
  try {
    await mkdir(join(directory, "nested"));
    await mkdir(join(directory, "skip"));
    await writeFile(join(directory, "top.txt"), "one");
    await writeFile(join(directory, "nested", "included.txt"), "two");
    await writeFile(join(directory, "nested", "excluded.log"), "three");
    await writeFile(join(directory, "skip", "ignored.txt"), "four");
    const entries = [];
    archive.on("entry", (entry) => entries.push(entry.name));
    const ended = new Promise((resolve, reject) => {
      archive.on("end", resolve);
      archive.on("error", reject);
    });
    archive.resume();
    archive.glob("**/*.txt", { cwd: directory, ignore: "skip/**" });
    await archive.finalize();
    await ended;
    assert.deepEqual(entries.sort(), ["nested/included.txt", "top.txt"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

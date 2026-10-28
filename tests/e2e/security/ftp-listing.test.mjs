import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import test from "node:test";
import { promisify } from "node:util";

const require = createRequire(import.meta.url);
const sdk = createRequire(
  require.resolve("browserstack-node-sdk/package.json"),
);
const proxy = createRequire(sdk.resolve("pac-proxy-agent"));
const getUri = createRequire(proxy.resolve("get-uri"));

test("FTP listing parser rejects a pathological line without blocking", async () => {
  // Isolate the CPU-bound regression so a vulnerable regex cannot hang this suite.
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [
      "--input-type=commonjs",
      "--eval",
      `const assert = require("node:assert/strict");
     const { Client, parseList } = require(process.argv[1]);
     for (const method of ["access", "lastMod", "list", "downloadTo", "close"]) {
       assert.equal(typeof Client.prototype[method], "function");
     }
     const malformed = "-rw-r--r-- 1 " + "a ".repeat(256 * 1024) + "!";
     const entries = parseList(malformed + "\\r\\n-rw-r--r-- 1 owner group 42 Jan 1 2020 file.txt\\r\\n");
     assert.equal(entries.length, 1);
     assert.equal(entries[0].name, "file.txt");
     assert.equal(entries[0].size, 42);
     console.log("parsed");`,
      getUri.resolve("basic-ftp"),
    ],
    { timeout: 30_000, env: {} },
  );
  assert.equal(stdout.trim(), "parsed");
});

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const workflow = await readFile(
  new URL("../../.github/workflows/publish-mcp.yml", import.meta.url),
  "utf8",
);
const step = workflow.slice(
  workflow.indexOf("- name: Publish to the MCP Registry"),
);
const registryUrl =
  "https://registry.modelcontextprotocol.io/v0/servers?search=io.github.usekaneo/kaneo";
const lookup = step
  .slice(
    step.indexOf("          curl"),
    step.indexOf(registryUrl) + registryUrl.length + 1,
  )
  .split("\n")
  .map((line) => line.slice(10))
  .join("\n");

async function runLookup(respond) {
  const directory = await mkdtemp(join(tmpdir(), "kaneo-registry-test-"));
  const server = createServer(respond);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/servers`;
    const child = spawn("bash", ["-c", lookup.replace(registryUrl, url)], {
      env: { ...process.env, RUNNER_TEMP: directory },
    });
    let stderr = "";
    child.stderr.on("data", (data) => {
      stderr += data;
    });
    const status = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    const body = await readFile(
      join(directory, "mcp-registry.json"),
      "utf8",
    ).catch(() => "");
    return { status, stderr, body };
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}

test("registry lookup retries an interrupted response without retaining its partial JSON", async () => {
  let requests = 0;
  const expected = {
    servers: [
      { server: { name: "io.github.usekaneo/kaneo", version: "0.1.12" } },
    ],
  };
  const result = await runLookup((_request, response) => {
    if (++requests === 1) {
      response.writeHead(200, { "Content-Length": 1000 });
      response.flushHeaders();
      response.write('{"servers":[{"server":{"name":"interrupted');
      setTimeout(() => response.destroy(), 10);
      return;
    }
    response.end(JSON.stringify(expected));
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(requests, 2);
  assert.deepEqual(JSON.parse(result.body), expected);
});

test("registry lookup fails after bounded retries when the service remains unavailable", async () => {
  let requests = 0;
  const result = await runLookup((_request, response) => {
    requests++;
    response.writeHead(503);
    response.end("Registry unavailable");
  });
  assert.notEqual(result.status, 0);
  assert.equal(requests, 4);
});

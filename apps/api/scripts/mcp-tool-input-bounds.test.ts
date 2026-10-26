import assert from "node:assert/strict";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServerForUser } from "../src/mcp/legacy-server.ts";
import { createModernMcpHandler } from "../src/mcp/modern.ts";
import {
  MCP_BODY_BYTES,
  MCP_MAX_TOOL_INPUT_ELEMENTS,
} from "../src/mcp/request-bounds.ts";

const toolName = "set_task_custom_field_value";
const protocolVersion = "2026-07-28";
const normal = { taskId: "task", fieldId: "field", value: ["one"] };
const cases = [
  { name: "normal", args: normal, reject: false },
  {
    name: "larger multiselect",
    args: { ...normal, value: Array.from({ length: 101 }, (_, i) => `v${i}`) },
    reject: false,
  },
  {
    name: "excess array elements",
    args: {
      ...normal,
      value: Array.from(
        { length: MCP_MAX_TOOL_INPUT_ELEMENTS + 1 },
        (_, i) => `v${i}`,
      ),
    },
    reject: true,
  },
  {
    name: "excess nested object keys",
    args: {
      ...normal,
      extra: Object.fromEntries(
        Array.from({ length: MCP_MAX_TOOL_INPUT_ELEMENTS + 1 }, (_, i) => [
          `key${i}`,
          i,
        ]),
      ),
    },
    reject: true,
  },
];

function toolRequest(
  args: Record<string, unknown>,
  id: number,
  modern: boolean,
): Request {
  return new Request("http://mcp.test/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...(modern
        ? {
            "mcp-method": "tools/call",
            "mcp-name": toolName,
            "mcp-protocol-version": protocolVersion,
          }
        : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
        ...(modern
          ? {
              _meta: {
                "io.modelcontextprotocol/protocolVersion": protocolVersion,
                "io.modelcontextprotocol/clientInfo": {
                  name: "bounds-test",
                  version: "1",
                },
                "io.modelcontextprotocol/clientCapabilities": {},
              },
            }
          : {}),
      },
    }),
  });
}

async function assertToolResult(
  response: Response,
  shouldReject: boolean,
): Promise<void> {
  assert.equal(response.status, 200);
  const text = await response.text();
  const data =
    text
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6) ?? text;
  const body = JSON.parse(data) as {
    result?: { isError?: boolean; content?: Array<{ text?: string }> };
  };
  assert.equal(body.result?.isError, shouldReject);
  if (shouldReject) {
    assert.ok(
      body.result?.content?.[0]?.text?.includes(
        `maximum of ${MCP_MAX_TOOL_INPUT_ELEMENTS} elements`,
      ),
    );
  }
}

const originalFetch = globalThis.fetch;
let apiCalls = 0;
globalThis.fetch = async (input, init) => {
  assert.equal(new URL(String(input)).pathname, "/api/custom-field/value");
  assert.equal(init?.method, "PUT");
  assert.equal(
    new Headers(init?.headers).get("authorization"),
    "Bearer test-token",
  );
  apiCalls++;
  return Response.json({});
};

try {
  for (const [index, testCase] of cases.entries()) {
    apiCalls = 0;
    const modern = createModernMcpHandler("test-token", "http://api.test");
    await assertToolResult(
      await modern.fetch(toolRequest(testCase.args, index + 1, true)),
      testCase.reject,
    );
    assert.equal(apiCalls, testCase.reject ? 0 : 1, `modern: ${testCase.name}`);

    apiCalls = 0;
    const legacy = createMcpServerForUser("test-token", "http://api.test");
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      maxRequestBodySize: MCP_BODY_BYTES,
    });
    try {
      await legacy.connect(transport);
      await assertToolResult(
        await transport.handleRequest(
          toolRequest(testCase.args, index + 1, false),
        ),
        testCase.reject,
      );
      assert.equal(
        apiCalls,
        testCase.reject ? 0 : 1,
        `legacy: ${testCase.name}`,
      );
    } finally {
      await legacy.close();
    }
  }
  console.log("MCP native bounds: 8 protocol/input cases passed");
} finally {
  globalThis.fetch = originalFetch;
}

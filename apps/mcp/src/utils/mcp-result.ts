import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function textResult(data: unknown, isError = false): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
    isError,
  };
}

export function errorResult(message: string): CallToolResult {
  return textResult({ error: message }, true);
}

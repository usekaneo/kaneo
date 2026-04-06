import { describe, expect, it } from "vitest";
import { mergeMcpServerEntry } from "./merge-config.js";

describe("mergeMcpServerEntry", () => {
  it("creates mcpServers when file is empty", () => {
    const out = mergeMcpServerEntry(null, "kaneo", {
      command: "/usr/bin/node",
      args: ["/app/index.js"],
    });
    expect(JSON.parse(out)).toEqual({
      mcpServers: {
        kaneo: {
          command: "/usr/bin/node",
          args: ["/app/index.js"],
        },
      },
    });
  });

  it("rejects empty string existing config as invalid JSON", () => {
    expect(() =>
      mergeMcpServerEntry("", "kaneo", {
        command: "/usr/bin/node",
        args: ["/app/index.js"],
      }),
    ).toThrow("Existing MCP config is not valid JSON");
  });

  it("merges without removing other servers or top-level keys", () => {
    const existing = JSON.stringify({
      other: true,
      mcpServers: {
        other: { command: "x", args: ["y"] },
      },
    });
    const out = mergeMcpServerEntry(existing, "kaneo", {
      command: "/usr/bin/node",
      args: ["/app/index.js"],
      env: { KANEO_API_URL: "http://localhost:1337" },
    });
    expect(JSON.parse(out)).toEqual({
      other: true,
      mcpServers: {
        other: { command: "x", args: ["y"] },
        kaneo: {
          command: "/usr/bin/node",
          args: ["/app/index.js"],
          env: { KANEO_API_URL: "http://localhost:1337" },
        },
      },
    });
  });
});

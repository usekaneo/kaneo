import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import type { ContextReport } from "./context-report.js";
import { renderContext } from "./render-context.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

const report: ContextReport = {
  server: { url: "http://localhost:1337", source: "env" },
  web: { url: "http://localhost:1337", source: "server" },
  profile: { name: "work", source: "flag", stored: true, matchesServer: true },
  auth: { method: "api-key", source: "env", fingerprint: "a1b2", error: null },
  user: { id: "u1", name: "Ada Lovelace", email: "ada@example.com" },
  workspace: {
    id: "ws_1",
    source: "repo",
    path: "/repo/.kaneo.json",
    name: "Acme Studio",
  },
  project: {
    ref: "KAN",
    source: "env",
    path: null,
    id: "p1",
    key: "KAN",
    name: "Kaneo Web",
  },
  config: { path: "/home/ada/.config/kaneo/config.json", status: "missing" },
  output: {
    mode: "human",
    source: "terminal",
    jq: null,
    interactive: true,
    stdinIsTTY: true,
    stdoutIsTTY: true,
    stderrIsTTY: true,
    terminal: {
      color: 3,
      unicode: true,
      hyperlinks: true,
      animate: true,
      columns: 80,
    },
  },
};

describe("renderContext", () => {
  it("shows each value with where it came from, never the secret", () => {
    expect(renderContext(ui, report)).toEqual([
      "",
      "  Server     http://localhost:1337                KANEO_API_URL",
      "  Web app    http://localhost:1337                same as the server",
      "  Profile    work                                 --profile",
      "  Auth       API key …a1b2                        KANEO_API_KEY",
      "  User       Ada Lovelace · ada@example.com",
      "  Workspace  Acme Studio ws_1                     /repo/.kaneo.json",
      "  Project    Kaneo Web KAN                        KANEO_PROJECT",
      "  Config     /home/ada/.config/kaneo/config.json  not created yet",
      "  Output     human                                stdout is a terminal",
      "  Terminal   truecolor · unicode · hyperlinks · 80 columns  interactive",
      "",
    ]);
  });

  it("explains a failed account lookup", () => {
    const lines = renderContext(ui, {
      ...report,
      user: null,
      auth: {
        ...report.auth,
        error: "The API key in KANEO_API_KEY was rejected.",
      },
    });
    expect(lines[5]).toBe(
      "  User       ✗ The API key in KANEO_API_KEY was rejected.",
    );
  });
});

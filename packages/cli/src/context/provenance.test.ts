import { Option, Redacted } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { emptyConfig, withProfile } from "../config/format.js";
import type { SessionInputs } from "../services/session.js";
import { outputProvenance } from "./output-provenance.js";
import { buildProvenance, fingerprint } from "./provenance.js";

const config = withProfile(emptyConfig, "work", () => ({
  apiUrl: "https://kaneo.example.com",
  webUrl: "https://app.example.com",
  token: "stored-session-token-1234",
  workspaceId: "ws_profile",
}));

function inputs(overrides: Partial<SessionInputs> = {}): SessionInputs {
  return {
    flags: {
      token: Option.none(),
      apiUrl: Option.none(),
      workspace: Option.none(),
      profile: Option.none(),
    },
    env: {},
    config,
    configProblem: Option.none(),
    repo: undefined,
    ...overrides,
  };
}

describe("buildProvenance", () => {
  it("attributes everything to the active profile by default", () => {
    expect(buildProvenance(inputs())).toEqual({
      server: { url: "https://kaneo.example.com", source: "profile" },
      web: { url: "https://app.example.com", source: "profile" },
      profile: {
        name: "work",
        source: "config",
        stored: true,
        matchesServer: true,
      },
      auth: { method: "login", source: "profile", fingerprint: "1234" },
      workspace: { id: "ws_profile", source: "profile", path: null },
      project: { ref: null, source: "none", path: null },
    });
  });

  it("reports flags and environment variables over the profile", () => {
    const provenance = buildProvenance(
      inputs({
        flags: {
          token: Option.some(Redacted.make("flag-token-abcdefgh")),
          apiUrl: Option.some("http://localhost:1337/"),
          workspace: Option.some("ws_flag"),
          profile: Option.none(),
        },
        env: { KANEO_PROFILE: "work", KANEO_WEB_URL: "http://localhost:5173" },
      }),
    );
    expect(provenance.server).toEqual({
      url: "http://localhost:1337",
      source: "flag",
    });
    expect(provenance.web).toEqual({
      url: "http://localhost:5173",
      source: "env",
    });
    expect(provenance.profile).toEqual({
      name: "work",
      source: "env",
      stored: true,
      matchesServer: false,
    });
    expect(provenance.auth).toEqual({
      method: "token",
      source: "flag",
      fingerprint: "efgh",
    });
    expect(provenance.workspace).toEqual({
      id: "ws_flag",
      source: "flag",
      path: null,
    });
  });

  it("points at .kaneo.json for the repository link", () => {
    const provenance = buildProvenance(
      inputs({
        env: { KANEO_API_KEY: "short" },
        repo: {
          path: "/repo/.kaneo.json",
          workspace: "ws_repo",
          project: "KAN",
        },
      }),
    );
    expect(provenance.auth).toEqual({
      method: "api-key",
      source: "env",
      fingerprint: null,
    });
    expect(provenance.workspace).toEqual({
      id: "ws_repo",
      source: "repo",
      path: "/repo/.kaneo.json",
    });
    expect(provenance.project).toEqual({
      ref: "KAN",
      source: "repo",
      path: "/repo/.kaneo.json",
    });
    expect(
      buildProvenance(inputs({ env: { KANEO_PROJECT: "MOB" } })).project,
    ).toEqual({ ref: "MOB", source: "env", path: null });
  });

  it("works signed out with no config file", () => {
    const provenance = buildProvenance(inputs({ config: emptyConfig }));
    expect(provenance.server).toEqual({
      url: "https://cloud.kaneo.app",
      source: "default",
    });
    expect(provenance.web.source).toBe("server");
    expect(provenance.profile).toEqual({
      name: "default",
      source: "default",
      stored: false,
      matchesServer: false,
    });
    expect(provenance.auth).toEqual({
      method: null,
      source: "none",
      fingerprint: null,
    });
    expect(provenance.workspace.source).toBe("none");
  });
});

describe("fingerprint", () => {
  it("shows only the last four characters of long secrets", () => {
    expect(fingerprint("kaneo_live_abcdef123456")).toBe("3456");
    expect(fingerprint("short")).toBeNull();
  });
});

describe("outputProvenance", () => {
  it("follows the same order as the output mode", () => {
    const base = { json: false, human: false, env: {}, stdoutIsTTY: true };
    expect(outputProvenance({ ...base, json: true, human: true })).toEqual({
      mode: "json",
      source: "flag",
    });
    expect(
      outputProvenance({ ...base, human: true, stdoutIsTTY: false }),
    ).toEqual({
      mode: "human",
      source: "flag",
    });
    expect(outputProvenance({ ...base, env: { KANEO_JSON: "1" } })).toEqual({
      mode: "json",
      source: "env",
    });
    expect(outputProvenance(base)).toEqual({
      mode: "human",
      source: "terminal",
    });
    expect(outputProvenance({ ...base, stdoutIsTTY: false })).toEqual({
      mode: "json",
      source: "pipe",
    });
  });
});

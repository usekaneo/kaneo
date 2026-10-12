import { Option, Redacted } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { emptyConfig, withProfile } from "../config/format.js";
import {
  DEFAULT_API_URL,
  resolveSession,
  type SessionInputs,
} from "./session.js";

const config = withProfile(emptyConfig, "default", () => ({
  apiUrl: "https://kaneo.example.com/api/",
  webUrl: "https://app.example.com",
  token: "profile-token",
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

const token = (session: ReturnType<typeof resolveSession>) =>
  Option.map(session.credentials, (credentials) => [
    Redacted.value(credentials.token),
    credentials.source,
  ]);

describe("resolveSession", () => {
  it("uses the stored profile by default", () => {
    const session = resolveSession(inputs());
    expect(session.apiUrl).toBe("https://kaneo.example.com");
    expect(session.webUrl).toBe("https://app.example.com");
    expect(token(session)).toEqual(Option.some(["profile-token", "profile"]));
    expect(Option.getOrUndefined(session.workspace)).toEqual({
      id: "ws_profile",
      source: "profile",
    });
  });

  it("prefers --token, then KANEO_API_KEY, then the profile", () => {
    expect(
      token(
        resolveSession(
          inputs({
            flags: {
              ...inputs().flags,
              token: Option.some(Redacted.make("flag")),
            },
            env: { KANEO_API_KEY: "env" },
          }),
        ),
      ),
    ).toEqual(Option.some(["flag", "flag"]));
    expect(
      token(resolveSession(inputs({ env: { KANEO_API_KEY: "env" } }))),
    ).toEqual(Option.some(["env", "env"]));
  });

  it("never sends a stored token to a different server", () => {
    const session = resolveSession(
      inputs({
        flags: { ...inputs().flags, apiUrl: Option.some("https://evil.test") },
      }),
    );
    expect(session.apiUrl).toBe("https://evil.test");
    expect(Option.isNone(session.credentials)).toBe(true);
    expect(Option.isNone(session.workspace)).toBe(true);
  });

  it("resolves the workspace from flag, env, repo file, then profile", () => {
    const repo = {
      path: "/r/.kaneo.json",
      workspace: "ws_repo",
      project: undefined,
    };
    expect(
      Option.getOrUndefined(
        resolveSession(inputs({ env: { KANEO_WORKSPACE: "ws_env" }, repo }))
          .workspace,
      ),
    ).toEqual({ id: "ws_env", source: "env" });
    expect(
      Option.getOrUndefined(resolveSession(inputs({ repo })).workspace),
    ).toEqual({
      id: "ws_repo",
      source: "repo",
    });
  });

  it("falls back to the cloud with no configuration", () => {
    const session = resolveSession(inputs({ config: emptyConfig }));
    expect(session.apiUrl).toBe(DEFAULT_API_URL);
    expect(Option.isNone(session.credentials)).toBe(true);
  });
});

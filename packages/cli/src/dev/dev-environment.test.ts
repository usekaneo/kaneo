import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { emptyConfig, withProfile } from "../config/format.js";
import { resolveSession } from "../services/session.js";
import {
  DEFAULT_DEV_API_URL,
  devApiUrl,
  devEnvironment,
} from "./dev-environment.js";

const installedLogin = withProfile(emptyConfig, "default", () => ({
  apiUrl: "https://kaneo.example.com",
  webUrl: "https://app.example.com",
  token: "real-token",
  workspaceId: "ws_real",
}));

const shell = {
  KANEO_API_URL: "https://kaneo.example.com",
  KANEO_API_KEY: "real-key",
  KANEO_WEB_URL: "https://app.example.com",
  KANEO_CONFIG: "/home/me/.config/kaneo/config.json",
  KANEO_JSON: "true",
};

const noFlags = {
  token: Option.none(),
  apiUrl: Option.none(),
  workspace: Option.none(),
  profile: Option.none(),
};

describe("devApiUrl", () => {
  it("reads KANEO_API_URL from the root .env", () => {
    expect(
      devApiUrl('AUTH_SECRET=x\nKANEO_API_URL="http://localhost:4000"\n'),
    ).toBe("http://localhost:4000");
  });

  it("falls back to the API's default", () => {
    expect(devApiUrl(undefined)).toBe(DEFAULT_DEV_API_URL);
    expect(devApiUrl("AUTH_SECRET=x\n")).toBe(DEFAULT_DEV_API_URL);
    expect(devApiUrl("KANEO_API_URL=\n")).toBe(DEFAULT_DEV_API_URL);
  });
});

describe("devEnvironment", () => {
  it("uses its own config file and the dev API", () => {
    const env = devEnvironment(
      shell,
      "/repo/packages/cli/.kaneo-dev/config.json",
      "http://localhost:4000",
    );
    expect(env.KANEO_CONFIG).toBe("/repo/packages/cli/.kaneo-dev/config.json");
    expect(env.KANEO_API_URL).toBe("http://localhost:4000");
    expect(env.KANEO_JSON).toBe("true");
  });

  it("never sends a real login or API key to the dev API", () => {
    const session = resolveSession({
      flags: noFlags,
      env: devEnvironment(shell, "/dev/config.json", DEFAULT_DEV_API_URL),
      config: installedLogin,
      configProblem: Option.none(),
      repo: undefined,
    });
    expect(session.apiUrl).toBe(DEFAULT_DEV_API_URL);
    expect(session.webUrl).toBe(DEFAULT_DEV_API_URL);
    expect(Option.isNone(session.credentials)).toBe(true);
    expect(Option.isNone(session.workspace)).toBe(true);
  });
});

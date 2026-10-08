import { describe, expect, it } from "vite-plus/test";
import { type ConfigFile, emptyConfig } from "../../config/format.js";
import { rememberWorkspace } from "./remember-workspace.js";

const signedIn: ConfigFile = {
  kind: "kaneo-cli",
  version: 1,
  activeProfile: "default",
  profiles: {
    default: {
      apiUrl: "http://localhost:1337",
      webUrl: "http://localhost:5173",
      token: "secret",
      workspaceId: "ws_old",
      user: { id: "u1", name: "Ada Lovelace", email: "ada@example.com" },
    },
    work: { apiUrl: "https://cloud.kaneo.app", token: "other" },
  },
};

describe("rememberWorkspace", () => {
  it("replaces only the workspace and keeps every other profile field", () => {
    const result = rememberWorkspace(
      signedIn,
      "default",
      "http://localhost:1337/",
      "ws_new",
    );
    expect(result).toEqual({
      kind: "saved",
      config: {
        ...signedIn,
        profiles: {
          ...signedIn.profiles,
          default: { ...signedIn.profiles.default, workspaceId: "ws_new" },
        },
      },
    });
  });

  it("creates a profile for the current server when none is stored", () => {
    const result = rememberWorkspace(
      emptyConfig,
      "default",
      "http://localhost:1337",
      "ws_new",
    );
    expect(result).toEqual({
      kind: "saved",
      config: {
        ...emptyConfig,
        profiles: {
          default: { apiUrl: "http://localhost:1337", workspaceId: "ws_new" },
        },
      },
    });
  });

  it("updates a named profile without switching the active one", () => {
    const result = rememberWorkspace(
      signedIn,
      "work",
      "https://cloud.kaneo.app",
      "ws_cloud",
    );
    expect(result.kind === "saved" && result.config.activeProfile).toBe(
      "default",
    );
    expect(result.kind === "saved" && result.config.profiles.work).toEqual({
      apiUrl: "https://cloud.kaneo.app",
      token: "other",
      workspaceId: "ws_cloud",
    });
  });

  it("refuses to write into a profile that belongs to another server", () => {
    expect(
      rememberWorkspace(signedIn, "work", "http://localhost:1337", "ws_new"),
    ).toEqual({
      kind: "other-server",
      profileApiUrl: "https://cloud.kaneo.app",
    });
  });
});

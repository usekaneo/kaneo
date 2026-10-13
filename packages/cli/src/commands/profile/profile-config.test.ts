import { describe, expect, it } from "vite-plus/test";
import type { ConfigFile } from "../../config/format.js";
import { makeUi } from "../../render/ui.js";
import {
  listProfiles,
  removeProfile,
  renameProfile,
  useProfile,
} from "./profile-config.js";
import { renderProfileList } from "./render-profile-list.js";

const config: ConfigFile = {
  kind: "kaneo-cli",
  version: 1,
  activeProfile: "work",
  profiles: {
    work: {
      apiUrl: "https://cloud.kaneo.app",
      token: "secret-token",
      user: { id: "u1", name: "Ada Lovelace", email: "ada@example.com" },
    },
    home: { apiUrl: "http://localhost:1337" },
  },
};

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

describe("profile config", () => {
  it("lists profiles without tokens and marks the active one", () => {
    const profiles = listProfiles(config, "work");
    expect(JSON.stringify(profiles)).not.toContain("secret-token");
    expect(
      profiles.map((profile) => [
        profile.name,
        profile.active,
        profile.signedIn,
      ]),
    ).toEqual([
      ["work", true, true],
      ["home", false, false],
    ]);
    expect(renderProfileList(ui, profiles)).toEqual([
      "",
      "  ●  work  cloud.kaneo.app  Ada Lovelace · ada@example.com",
      "     home  localhost:1337   signed out",
      "",
    ]);
  });

  it("switches only to stored profiles", () => {
    expect(useProfile(config, "home")?.activeProfile).toBe("home");
    expect(useProfile(config, "nope")).toBeUndefined();
  });

  it("removes a profile and moves the active one", () => {
    const removed = removeProfile(config, "work");
    expect(removed?.activeProfile).toBe("home");
    expect(Object.keys(removed?.profiles ?? {})).toEqual(["home"]);
    expect(removeProfile(config, "home")?.activeProfile).toBe("work");
  });

  it("renames in place and keeps the active profile", () => {
    const renamed = renameProfile(config, "work", "acme");
    expect(renamed.kind === "renamed" && renamed.config.activeProfile).toBe(
      "acme",
    );
    expect(
      renamed.kind === "renamed" && Object.keys(renamed.config.profiles),
    ).toEqual(["acme", "home"]);
    expect(renameProfile(config, "work", "home").kind).toBe("taken");
    expect(renameProfile(config, "nope", "x").kind).toBe("missing");
  });
});

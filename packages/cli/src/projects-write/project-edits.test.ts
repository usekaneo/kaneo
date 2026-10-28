import { Option, Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { ProjectRecord } from "../api/project-writes.js";
import {
  buildProjectUpdate,
  describeEdits,
  parseProjectEdits,
} from "./project-edits.js";

const none = {
  name: Option.none<string>(),
  key: Option.none<string>(),
  description: Option.none<string>(),
  icon: Option.none<string>(),
  public: false,
  private: false,
};

const current: ProjectRecord = {
  id: "p1",
  workspaceId: "w1",
  slug: "KAN",
  name: "Kaneo Web",
  icon: "Rocket",
  description: "Board",
  isPublic: false,
  archivedAt: null,
};

describe("parseProjectEdits", () => {
  it("needs at least one change", () => {
    const result = parseProjectEdits(none);
    expect(Result.isFailure(result) && result.failure.message).toBe(
      "Nothing to change.",
    );
  });

  it("refuses --public with --private", () => {
    expect(
      Result.isFailure(
        parseProjectEdits({ ...none, public: true, private: true }),
      ),
    ).toBe(true);
  });

  it("validates the key and the icon", () => {
    expect(
      Result.isFailure(parseProjectEdits({ ...none, key: Option.some("a b") })),
    ).toBe(true);
    expect(
      Result.isFailure(
        parseProjectEdits({ ...none, icon: Option.some("nope") }),
      ),
    ).toBe(true);
    expect(
      Result.getOrThrow(
        parseProjectEdits({
          ...none,
          key: Option.some("web"),
          icon: Option.some("folder-kanban"),
        }),
      ),
    ).toEqual({ key: "WEB", icon: "FolderKanban" });
  });

  it("refuses an empty name", () => {
    expect(
      Result.isFailure(parseProjectEdits({ ...none, name: Option.some("  ") })),
    ).toBe(true);
  });

  it("keeps an empty description, which clears it", () => {
    expect(
      Result.getOrThrow(
        parseProjectEdits({ ...none, description: Option.some("") }),
      ),
    ).toEqual({ description: "" });
  });
});

describe("buildProjectUpdate", () => {
  it("sends every field back unchanged except the edited ones", () => {
    expect(
      buildProjectUpdate(current, { name: "Web", isPublic: true }),
    ).toEqual({
      name: "Web",
      icon: "Rocket",
      slug: "KAN",
      description: "Board",
      isPublic: true,
    });
  });

  it("fills the fields the API requires when they are null", () => {
    expect(
      buildProjectUpdate(
        { ...current, icon: null, description: null, isPublic: null },
        { key: "WEB" },
      ),
    ).toEqual({
      name: "Kaneo Web",
      icon: "Layout",
      slug: "WEB",
      description: "",
      isPublic: false,
    });
  });
});

describe("describeEdits", () => {
  it("lists the changed fields", () => {
    expect(describeEdits({ name: "Web", key: "WEB", isPublic: false })).toBe(
      "name, key, now private",
    );
  });
});

import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { WorkspaceSource } from "../../services/session.js";
import { overrideNotice } from "./override-notice.js";

const from = (source: WorkspaceSource, id = "ws_other") =>
  Option.some({ id, source });

describe("overrideNotice", () => {
  it("stays quiet without an override", () => {
    expect(overrideNotice(Option.none(), undefined, "ws_acme")).toBeNull();
    expect(overrideNotice(from("profile"), undefined, "ws_acme")).toBeNull();
  });

  it("stays quiet when the override already points at the chosen workspace", () => {
    expect(
      overrideNotice(from("env", "ws_acme"), undefined, "ws_acme"),
    ).toBeNull();
  });

  it("names the source that wins over the saved default", () => {
    expect(overrideNotice(from("flag"), undefined, "ws_acme")).toContain("-w");
    expect(overrideNotice(from("env"), undefined, "ws_acme")).toContain(
      "KANEO_WORKSPACE",
    );
    expect(
      overrideNotice(from("repo"), "/code/app/.kaneo.json", "ws_acme"),
    ).toContain("/code/app/.kaneo.json");
  });
});

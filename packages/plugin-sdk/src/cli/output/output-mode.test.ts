import { describe, expect, it } from "vite-plus/test";
import { resolveOutputMode } from "./output-mode.js";

describe("resolveOutputMode", () => {
  it("defaults to human on a terminal and JSON otherwise", () => {
    expect(resolveOutputMode(["build"], {}, true)).toBe("human");
    expect(resolveOutputMode(["build"], {}, false)).toBe("json");
  });

  it("lets flags override the environment and the terminal", () => {
    expect(resolveOutputMode(["build", "--human"], {}, false)).toBe("human");
    expect(resolveOutputMode(["build", "--json"], {}, true)).toBe("json");
    expect(
      resolveOutputMode(["build", "--human"], { KANEO_JSON: "true" }, true),
    ).toBe("human");
    expect(resolveOutputMode(["build"], { KANEO_JSON: "1" }, true)).toBe(
      "json",
    );
  });

  it("ignores flags after --", () => {
    expect(resolveOutputMode(["build", "--", "--json"], {}, true)).toBe(
      "human",
    );
  });
});

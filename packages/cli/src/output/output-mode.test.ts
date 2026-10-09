import { describe, expect, it } from "vite-plus/test";
import { resolveOutputMode } from "./output-mode.js";

describe("resolveOutputMode", () => {
  it("defaults to human on a terminal and JSON otherwise", () => {
    expect(resolveOutputMode([], {}, true)).toBe("human");
    expect(resolveOutputMode([], {}, false)).toBe("json");
  });

  it("lets flags override the environment and the terminal", () => {
    expect(resolveOutputMode(["--human"], {}, false)).toBe("human");
    expect(resolveOutputMode(["--json"], {}, true)).toBe("json");
    expect(resolveOutputMode(["--human"], { KANEO_JSON: "true" }, true)).toBe(
      "human",
    );
    expect(resolveOutputMode([], { KANEO_JSON: "true" }, true)).toBe("json");
  });

  it("treats --jq as JSON mode", () => {
    expect(resolveOutputMode(["task", "list", "--jq", ".[0]"], {}, true)).toBe(
      "json",
    );
    expect(resolveOutputMode(["--jq=.id"], {}, true)).toBe("json");
  });

  it("ignores flags after --", () => {
    expect(resolveOutputMode(["task", "--", "--json"], {}, true)).toBe("human");
  });
});

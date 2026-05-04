import { afterEach, describe, expect, it, vi } from "vitest";
import { resolvePublicEnvVar } from "./runtime-public-env";

describe("resolvePublicEnvVar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns build-time value when window is undefined", () => {
    expect(resolvePublicEnvVar("VITE_API_URL", "http://localhost:1337")).toBe(
      "http://localhost:1337",
    );
  });

  it("prefers runtime config when set in the browser", () => {
    vi.stubGlobal("window", {
      __KANEO_RUNTIME_CONFIG__: {
        VITE_API_URL: "https://app.example.com/api",
      },
    });
    expect(resolvePublicEnvVar("VITE_API_URL", "http://localhost:1337")).toBe(
      "https://app.example.com/api",
    );
  });

  it("ignores empty runtime strings", () => {
    vi.stubGlobal("window", {
      __KANEO_RUNTIME_CONFIG__: { VITE_API_URL: "   " },
    });
    expect(resolvePublicEnvVar("VITE_API_URL", "http://x")).toBe("http://x");
  });
});

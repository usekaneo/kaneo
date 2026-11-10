import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { SDK_VERSION } from "../src/version";
import Quackback from "../src/index";

describe("SDK_VERSION", () => {
  it("matches package.json version", () => {
    const pkg = JSON.parse(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), "../package.json"),
        "utf8",
      ),
    ) as { version: string };
    expect(SDK_VERSION).toBe(pkg.version);
  });

  it("is exposed on the Quackback singleton", () => {
    expect(Quackback.version).toBe(SDK_VERSION);
  });
});

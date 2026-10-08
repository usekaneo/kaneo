import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { findKaneoVersion } from "../../../apps/api/src/plugin-host/kaneo-version";
import { createTempDir, removeTempDirs, writeFiles } from "./fixtures";

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
  await removeTempDirs();
});

async function monorepo() {
  const root = await createTempDir();
  await writeFiles(root, {
    "package.json": JSON.stringify({ name: "kaneo", version: "2.29.3" }),
    "apps/api/package.json": JSON.stringify({ name: "@kaneo/api" }),
    "apps/api/dist/.keep": "",
  });
  return root;
}

describe("findKaneoVersion", () => {
  it("walks up past other packages to the kaneo root package", async () => {
    const root = await monorepo();
    expect(findKaneoVersion(join(root, "apps/api"))).toBe("2.29.3");
    expect(findKaneoVersion(join(root, "apps/api/dist"))).toBe("2.29.3");
    expect(findKaneoVersion(root)).toBe("2.29.3");
  });

  it("returns null when no kaneo package exists", async () => {
    const root = await createTempDir();
    await writeFiles(root, {
      "package.json": JSON.stringify({ name: "other", version: "1.0.0" }),
    });
    expect(findKaneoVersion(root)).toBeNull();
  });
});

describe("getKaneoVersion", () => {
  it("prefers KANEO_VERSION", async () => {
    vi.stubEnv("KANEO_VERSION", "3.1.0");
    const { getKaneoVersion } =
      await import("../../../apps/api/src/plugin-host/kaneo-version");
    expect(getKaneoVersion()).toBe("3.1.0");
  });

  it("falls back to the working directory and caches the result", async () => {
    vi.stubEnv("KANEO_VERSION", "");
    const root = await monorepo();
    const cwd = vi
      .spyOn(process, "cwd")
      .mockReturnValue(join(root, "apps/api"));
    const { getKaneoVersion } =
      await import("../../../apps/api/src/plugin-host/kaneo-version");
    expect(getKaneoVersion()).toBe("2.29.3");
    vi.stubEnv("KANEO_VERSION", "9.9.9");
    expect(getKaneoVersion()).toBe("2.29.3");
    expect(cwd).toHaveBeenCalledTimes(1);
  });
});

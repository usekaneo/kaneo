import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { configPath } from "./config-path.js";
import { makeConfigStore } from "./config-store.js";
import { emptyConfig, withProfile } from "./format.js";

async function tempPath() {
  const directory = await mkdtemp(join(tmpdir(), "kaneo-cli-"));
  return join(directory, "kaneo", "config.json");
}

describe("configPath", () => {
  it("honors KANEO_CONFIG, then XDG_CONFIG_HOME, then ~/.config", () => {
    expect(configPath({ KANEO_CONFIG: "/x/c.json" }, "/home/a")).toBe(
      "/x/c.json",
    );
    expect(configPath({ XDG_CONFIG_HOME: "/xdg" }, "/home/a")).toBe(
      "/xdg/kaneo/config.json",
    );
    expect(configPath({}, "/home/a")).toBe("/home/a/.config/kaneo/config.json");
  });
});

describe("makeConfigStore", () => {
  it("returns an empty config when the file is missing", async () => {
    const store = makeConfigStore(await tempPath());
    expect(await Effect.runPromise(store.load)).toEqual(emptyConfig);
  });

  it("writes a private file in a private directory", async () => {
    const path = await tempPath();
    const store = makeConfigStore(path);
    const config = withProfile(emptyConfig, "default", () => ({
      apiUrl: "https://cloud.kaneo.app",
      token: "secret",
    }));
    await Effect.runPromise(store.save(config));
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect((await stat(join(path, ".."))).mode & 0o777).toBe(0o700);
    expect(await Effect.runPromise(store.load)).toEqual(config);
  });

  it("never overwrites a file from another kaneo CLI", async () => {
    const path = await tempPath();
    const store = makeConfigStore(path);
    await Effect.runPromise(store.save(emptyConfig));
    await writeFile(path, '{"apiKey":"community"}');
    const result = await Effect.runPromise(
      Effect.result(store.save(emptyConfig)),
    );
    expect(Result.isFailure(result) && result.failure.reason).toBe("foreign");
    expect(await readFile(path, "utf8")).toBe('{"apiKey":"community"}');
  });
});

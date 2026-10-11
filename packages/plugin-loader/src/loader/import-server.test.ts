import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  createTempDir,
  removeTempDirs,
  writeFiles,
} from "../testing/fixtures.js";
import { importServer } from "./import-server.js";

async function serverFile(settings: string): Promise<string> {
  const root = await createTempDir();
  await writeFiles(root, {
    "server.mjs": `export default { kind: "kaneo-server", apiVersion: 1, ${settings} setup() {} };\n`,
  });
  return join(root, "server.mjs");
}

describe("importServer", () => {
  afterEach(removeTempDirs);

  it("returns empty settings when the plugin declares none", async () => {
    const definition = await importServer(await serverFile(""));
    expect(definition.settings).toEqual({});
  });

  it("treats null settings as none, like defineServer", async () => {
    const definition = await importServer(await serverFile("settings: null,"));
    expect(definition.settings).toEqual({});
  });

  it("rejects settings that are not an object of fields", async () => {
    await expect(
      importServer(await serverFile('settings: "mode",')),
    ).rejects.toThrow(
      "The plugin's settings schema is invalid. Settings must be an object of fields.",
    );
  });
});

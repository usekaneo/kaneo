import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG_FILE_NAMES, configCandidates } from "@kaneo/plugin-loader";
import { addPluginToConfig } from "./config-source/add-plugin-to-config.js";
import { configTemplate } from "./config-source/config-template.js";
import { importNameFor } from "./import-name.js";

export type ConfigUpdate =
  | { status: "created"; file: string; importName: string }
  | { status: "updated"; file: string; importName: string }
  | { status: "present"; file: string }
  | { status: "manual"; file: string; importName: string; reason: string };

export async function updateConfigFile(
  projectDir: string,
  packageName: string,
): Promise<ConfigUpdate> {
  const file = configCandidates(projectDir).find((path) => existsSync(path));
  if (!file) {
    const created = join(projectDir, CONFIG_FILE_NAMES[0]);
    const importName = importNameFor(
      packageName,
      (name) => name === "defineConfig",
    );
    await writeFile(created, configTemplate(packageName, importName));
    return { status: "created", file: created, importName };
  }

  const result = addPluginToConfig(await readFile(file, "utf8"), packageName);
  switch (result.status) {
    case "updated":
      await writeFile(file, result.source);
      return { status: "updated", file, importName: result.importName };
    case "present":
      return { status: "present", file };
    case "manual":
      return {
        status: "manual",
        file,
        importName: result.importName,
        reason: result.reason,
      };
  }
}

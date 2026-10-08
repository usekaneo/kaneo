import { join } from "node:path";
import { CONFIG_FILE_NAMES } from "../../plugin-host/config/find-config-path";
import { loadDeclaredPlugins } from "../../plugin-host/config/load-declared-plugins";
import { checkPlugins } from "../../plugin-host/loader/check-plugins";
import type { Output } from "../io";

export type CheckInput = {
  projectDir: string;
  configPath: string | null;
  kaneoVersion: string | null;
};

export async function runCheck(
  { projectDir, configPath, kaneoVersion }: CheckInput,
  output: Output,
): Promise<number> {
  if (configPath) {
    output.log(
      `Checking ${configPath} against Kaneo ${kaneoVersion ?? "(unknown version)"}`,
    );
  } else {
    output.log(
      `No kaneo.config.ts, kaneo.config.js, or kaneo.config.mjs in ${projectDir}, so only the built-in plugins are checked.`,
    );
  }

  const declared = await loadDeclaredPlugins(configPath);
  const results = await checkPlugins(declared.descriptors, {
    configPath: configPath ?? join(projectDir, CONFIG_FILE_NAMES[0]),
    kaneoVersion,
    official: declared.official,
    onWarning: (message) => output.error(`warn  ${message}`),
  });

  for (const result of results) {
    if (result.ok) {
      output.log(`ok  ${result.id} ${result.version}`);
    } else {
      output.error(result.error.format());
    }
  }
  if (configPath && declared.config.plugins.length === 0) {
    output.log(`${configPath} declares no plugins.`);
  }

  const failed = results.filter((result) => !result.ok).length;
  if (failed > 0) {
    output.error(
      `${failed} of ${results.length} plugins failed. Kaneo would stop at startup with this config.`,
    );
    return 1;
  }
  return 0;
}

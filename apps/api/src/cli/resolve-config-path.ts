import { resolve } from "node:path";
import {
  configCandidates,
  findConfigPath,
} from "../plugin-host/config/find-config-path";
import { CliError } from "./cli-error";

export function resolveConfigPath({
  flag,
  env,
  cwd,
  projectDir,
  exists,
}: {
  flag: string | undefined;
  env: string | undefined;
  cwd: string;
  projectDir: string;
  exists: (path: string) => boolean;
}): string | null {
  if (flag !== undefined) {
    const path = resolve(cwd, flag);
    if (!exists(path)) {
      throw new CliError(`--config points to ${path}, which does not exist.`);
    }
    return path;
  }
  return findConfigPath({
    configEnv: env,
    cwd,
    exists,
    candidates: configCandidates(projectDir),
  });
}

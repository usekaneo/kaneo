import { resolve } from "node:path";
import { DEFAULT_PROJECT_DIR } from "../plugin-host/config/find-config-path";

export function resolveProjectDir({
  flag,
  env,
  cwd,
  exists,
}: {
  flag: string | undefined;
  env: string | undefined;
  cwd: string;
  exists: (path: string) => boolean;
}): string {
  if (flag?.trim()) return resolve(cwd, flag.trim());
  if (env?.trim()) return resolve(cwd, env.trim());
  if (exists(DEFAULT_PROJECT_DIR)) return DEFAULT_PROJECT_DIR;
  return cwd;
}

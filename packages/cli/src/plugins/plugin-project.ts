import { existsSync, statSync } from "node:fs";
import { Effect, Option } from "effect";
import { InvalidArgument } from "../errors/errors.js";
import { CliEnvironment } from "../services/cli-environment.js";
import { resolveProjectDir } from "./project-dir.js";

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export const resolvePluginProject = Effect.fnUntraced(function* (
  flag: Option.Option<string>,
) {
  const environment = yield* CliEnvironment;
  const dir = resolveProjectDir({
    flag: Option.getOrUndefined(flag),
    env: environment.env.KANEO_PROJECT_DIR,
    cwd: environment.cwd,
    exists: existsSync,
  });
  if (!isDirectory(dir)) {
    return yield* new InvalidArgument({
      message: `The project directory ${dir} does not exist.`,
      hint: "Pass --project <dir>, or set KANEO_PROJECT_DIR.",
    });
  }
  return dir;
});

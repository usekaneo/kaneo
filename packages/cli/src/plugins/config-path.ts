import { resolve } from "node:path";
import { configCandidates } from "@kaneo/plugin-loader";
import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

export function resolveConfigPath({
  flag,
  cwd,
  projectDir,
  exists,
}: {
  flag: string | undefined;
  cwd: string;
  projectDir: string;
  exists: (path: string) => boolean;
}): Result.Result<string | null, InvalidArgument> {
  if (flag !== undefined) {
    const path = resolve(cwd, flag);
    return exists(path)
      ? Result.succeed(path)
      : Result.fail(
          new InvalidArgument({
            message: `--config points to ${path}, which does not exist.`,
          }),
        );
  }
  return Result.succeed(
    configCandidates(projectDir).find((path) => exists(path)) ?? null,
  );
}

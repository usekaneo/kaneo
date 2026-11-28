import { Result } from "effect";
import semver from "semver";
import { InvalidArgument } from "../errors/errors.js";

export type KaneoVersionSource = "flag" | "installation" | "config-package";

export type KaneoTarget = {
  readonly version: string;
  readonly source: KaneoVersionSource;
};

export function resolveKaneoTarget({
  flag,
  installationVersion,
  configPackageVersion,
}: {
  flag: string | undefined;
  installationVersion: string | null;
  configPackageVersion: string | null;
}): Result.Result<KaneoTarget, InvalidArgument> {
  if (flag !== undefined) {
    const version = semver.valid(flag.trim());
    return version
      ? Result.succeed({ version, source: "flag" })
      : Result.fail(
          new InvalidArgument({
            message: `--kaneo-version takes a Kaneo version such as 2.37.0, not "${flag}".`,
          }),
        );
  }
  if (installationVersion) {
    return Result.succeed({
      version: installationVersion,
      source: "installation",
    });
  }
  if (configPackageVersion) {
    return Result.succeed({
      version: configPackageVersion,
      source: "config-package",
    });
  }
  return Result.fail(
    new InvalidArgument({
      message:
        "Could not tell which Kaneo version the plugins are for. Pass --kaneo-version with the Kaneo version you run, run the command inside a Kaneo installation such as the Kaneo Docker image, or install @kaneo/config for your Kaneo version in the project.",
    }),
  );
}
